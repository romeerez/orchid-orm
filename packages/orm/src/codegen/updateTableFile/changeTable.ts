import { RakeDbAst } from 'rake-db';
import fs from 'fs/promises';
import { FileChanges } from '../fileChanges';
import { ts } from '../tsUtils';
import { toPascalCase } from '../../utils';
import {
  CallExpression,
  Expression,
  NodeArray,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment,
  Statement,
} from 'typescript';
import {
  codeToString,
  columnDefaultArgumentToCode,
  columnForeignKeysToCode,
  columnIndexesToCode,
  ColumnType,
  ForeignKey,
  foreignKeyToCode,
  IndexColumnOptions,
  indexToCode,
  primaryKeyToCode,
  TableData,
} from 'pqb';
import {
  addCode,
  Code,
  quoteObjectKey,
  singleQuote,
  pathToLog,
} from 'orchid-core';
import { UpdateTableFileParams } from './updateTableFile';

export const changeTable = async ({
  ast,
  logger,
  ...params
}: UpdateTableFileParams & { ast: RakeDbAst.ChangeTable }) => {
  const tablePath = params.tablePath(ast.name);
  const content = await fs.readFile(tablePath, 'utf-8').catch(() => undefined);
  if (!content) return;

  const changes = new FileChanges(content);
  const statements = ts.getStatements(content);
  const className = toPascalCase(ast.name) + 'Table';

  for (const { t, object } of iterateColumnsShapes(statements, className)) {
    const context = makeChangeContext(changes, ast, content, object, t);

    prependSpaces(context);
    applySchemaChanges(context);
    appendTrailingComma(context);
    addColumns(context);
    addTableData(context);
  }

  await fs.writeFile(tablePath, changes.apply());
  logger?.log(`Updated ${pathToLog(tablePath)}`);
};

function* iterateColumnsShapes(
  statements: NodeArray<Statement>,
  className: string,
) {
  for (const node of ts.class.iterate(statements)) {
    if (node.name?.escapedText !== className) continue;

    for (const member of node.members) {
      const name = ts.prop.getName(member);
      const { initializer: call } = member as unknown as {
        initializer?: Expression;
      };

      if (name !== 'columns' || !call || !ts.is.call(call)) continue;

      const { expression } = call;
      if (
        !ts.is.propertyAccess(expression) ||
        !ts.is.this(expression.expression) ||
        expression.name.escapedText !== 'setColumns'
      )
        continue;

      const [arg] = call.arguments;
      if (!ts.is.arrowFunction(arg)) continue;

      const { parameters, body } = arg;
      const param = parameters[0]?.name;
      if (!ts.is.identifier(param) || !ts.is.parenthesizedExpression(body))
        continue;

      const { expression: object } = body;
      if (!ts.is.objectLiteral(object)) continue;

      yield { t: param.escapedText.toString(), object };
    }
  }
}

type ChangeContext = {
  changes: FileChanges;
  props: NodeArray<ObjectLiteralElementLike>;
  shape: {
    add: Record<string, ColumnType>;
    drop: Record<string, true>;
    change: Record<string, RakeDbAst.ChangeTableItem.Change>;
  };
  t: string;
  spaces: string;
  object: Expression;
  drop: TableData;
  add: TableData;
};

const makeChangeContext = (
  changes: FileChanges,
  ast: RakeDbAst.ChangeTable,
  content: string,
  object: ObjectLiteralExpression,
  t: string,
): ChangeContext => {
  const add: ChangeContext['shape']['add'] = {};
  const drop: ChangeContext['shape']['drop'] = {};
  const change: ChangeContext['shape']['change'] = {};

  const { properties: props } = object;
  const existingColumns = getExistingColumns(props);

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (item.type === 'add' && !existingColumns[key]) {
      add[key] = item.item;
    }

    if (!existingColumns[key]) continue;

    if (item.type === 'drop' && existingColumns[key]) {
      drop[key] = true;
    } else if (item.type === 'change' && existingColumns[key]) {
      change[key] = item;
    }
  }

  const spaces = ts.spaces.getAtLine(content, object.end);

  const shape = { add, drop, change };
  return {
    changes,
    props,
    shape,
    spaces,
    t,
    object,
    add: ast.add,
    drop: ast.drop,
  };
};

const getExistingColumns = (props: NodeArray<ObjectLiteralElementLike>) => {
  const existingColumns: Record<string, true> = {};
  props
    .map((prop) => ts.is.propertyAssignment(prop) && ts.prop.getName(prop))
    .filter((name): name is string => !!name)
    .forEach((name) => (existingColumns[name] = true));

  for (const prop of props) {
    if (!ts.is.propertyAssignment(prop)) continue;
    const name = ts.prop.getName(prop);
    if (name) existingColumns[name] = true;
  }

  return existingColumns;
};

const prependSpaces = ({
  props,
  shape: { add },
  changes,
  spaces,
}: ChangeContext) => {
  if (Object.keys(add).length && props.pos === props.end) {
    changes.add(props.pos, `\n${spaces}`);
  }
};

const applySchemaChanges = (context: ChangeContext) => {
  const {
    props,
    shape: { drop: dropColumns, change: changeColumns },
    add,
    drop,
  } = context;

  props.forEach((prop, i) => {
    if (ts.is.spreadAssignment(prop)) {
      const call = prop.expression;
      if (!ts.is.call(call)) return;

      const access = call.expression;
      if (!ts.is.propertyAccess(access)) return;

      const name = access.name.escapedText.toString();
      if (name === 'primaryKey') {
        if (drop.primaryKey || add.primaryKey) {
          removeProp(context, prop, i);
        }
      } else if (name === 'index') {
        dropMatchingIndexes(context, prop, i, call, drop.indexes);
      } else if (name === 'foreignKey') {
        dropMatchingForeignKey(context, prop, i, call, drop.foreignKeys);
      }
    } else if (ts.is.propertyAssignment(prop)) {
      const name = ts.prop.getName(prop);
      if (!name) return;

      if (dropColumns[name]) {
        removeProp(context, prop, i);
      } else {
        const changeItem = changeColumns[name];
        if (changeItem) {
          changeColumn(context, changeItem, prop);
        }
      }
    }
  });
};

const removeProp = (
  { props, changes }: ChangeContext,
  prop: ObjectLiteralElementLike,
  i: number,
) => {
  const end = props[i + 1]?.pos || props.end;
  changes.remove(prop.pos, end);
};

const changeColumn = (
  { changes, t, spaces }: ChangeContext,
  changeItem: RakeDbAst.ChangeTableItem.Change,
  prop: PropertyAssignment,
) => {
  const { from, to } = changeItem;
  if (from.type !== to.type && to.column) {
    changes.replace(
      prop.initializer.pos,
      prop.end,
      ` ${codeToString(to.column.toCode(t), spaces + '  ', '  ').trim()}`,
    );
    return;
  }

  const items: CallExpression[] = [];
  let chain: Expression | undefined = prop.initializer;
  while (ts.is.call(chain) && ts.is.propertyAccess(chain.expression)) {
    items.push(chain);
    chain = chain.expression.expression;
  }

  type Key = keyof RakeDbAst.ChangeTableItem.Change['to'];
  const propsToChange: Partial<Record<Key, true>> = {};

  for (const key in from) {
    if (to[key as Key] !== from[key as Key]) {
      propsToChange[key as Key] = true;
    }
  }

  for (const key in to) {
    if (to[key as Key] !== from[key as Key]) {
      propsToChange[key as Key] = true;
    }
  }

  const changedProps: Partial<Record<Key, true>> = {};
  const replaced: Record<string, true> = {};
  for (const item of items.reverse()) {
    if (!ts.is.propertyAccess(item.expression)) continue;

    const { name } = item.expression;
    let key = name.escapedText.toString();
    if (key === 'index') key = 'indexes';
    else if (key === 'foreignKey') key = 'foreignKeys';

    if (!propsToChange[key as Key]) continue;

    let remove = true;
    if (!replaced[key]) {
      const code = getColumnMethodArgs(t, to, key as Key);
      if (code) {
        changes.replace(
          item.expression.expression.end,
          item.end,
          codeToString(code, spaces + '  ', '  ').trim(),
        );
        replaced[key] = true;
        remove = false;
      }
    }

    if (remove) {
      changes.remove(item.expression.expression.end, item.end);
    }

    changedProps[key as Key] = true;
  }

  let append = '';
  for (const key in propsToChange) {
    if (changedProps[key as Key]) continue;

    const code = getColumnMethodArgs(t, to, key as Key);
    if (code) {
      append += codeToString(code, spaces + '  ', '  ').trim();
    }
  }

  if (append) {
    changes.add(prop.end, append);
  }
};

const appendTrailingComma = ({ props, changes }: ChangeContext) => {
  if (!props.hasTrailingComma) {
    const last = props[props.length - 1];
    if (last) {
      changes.add(last.end, ',');
    }
  }
};

const addColumns = ({
  shape: { add },
  changes,
  object,
  t,
  spaces,
}: ChangeContext) => {
  const end = object.end - 1;
  for (const key in add) {
    const code = codeToString(add[key].toCode(t), spaces + '  ', '  ');
    changes.add(end, `  ${quoteObjectKey(key)}: ${code.trim()},\n${spaces}`);
  }
};

const addTableData = ({ add, changes, object, t, spaces }: ChangeContext) => {
  const end = object.end - 1;
  if (add.primaryKey) {
    const code = codeToString(
      primaryKeyToCode(add.primaryKey, t),
      spaces,
      '  ',
    );
    changes.add(end, `  ${code.trim()}\n${spaces}`);
  }
  for (const item of add.indexes) {
    const code = codeToString(indexToCode(item, t), spaces + '  ', '  ');
    changes.add(end, `  ${code.trim()}\n${spaces}`);
  }
  for (const item of add.foreignKeys) {
    const code = codeToString(foreignKeyToCode(item, t), spaces + '  ', '  ');
    changes.add(end, `  ${code.trim()}\n${spaces}`);
  }
};

const getColumnMethodArgs = (
  t: string,
  to: RakeDbAst.ChangeTableItem.Change['to'],
  key: keyof RakeDbAst.ChangeTableItem.Change['to'],
): Code[] | undefined => {
  const value = to[key];
  if (!value) return;

  if (key === 'indexes') {
    return columnIndexesToCode(value as IndexColumnOptions[]);
  }

  if (key === 'foreignKeys') {
    return columnForeignKeysToCode(value as ForeignKey<string, string[]>[]);
  }

  const code = [`.${key}(`];

  if (key === 'collate' || key === 'compression') {
    addCode(code, singleQuote(value as string));
  } else if (key === 'default') {
    addCode(code, columnDefaultArgumentToCode(t, value));
  } else if (key !== 'nullable' && key !== 'primaryKey') {
    return;
  }

  addCode(code, ')');
  return code;
};

const dropMatchingIndexes = (
  context: ChangeContext,
  prop: ObjectLiteralElementLike,
  i: number,
  call: CallExpression,
  items: TableData.Index[],
) => {
  if (!items.length) return;

  const [columnsNode, optionsNode] = call.arguments;
  const columns: Record<string, string | number>[] = [];
  if (ts.is.stringLiteral(columnsNode)) {
    columns.push({ column: columnsNode.text });
  } else if (ts.is.arrayLiteral(columnsNode)) {
    for (const node of columnsNode.elements) {
      if (ts.is.stringLiteral(node)) {
        columns.push({ column: node.text });
      } else if (ts.is.objectLiteral(node)) {
        const object = collectObjectFromCode(node);
        if (!object) return;
        columns.push(object);
      }
    }
  } else {
    return;
  }

  const options =
    (ts.is.objectLiteral(optionsNode) && collectObjectFromCode(optionsNode)) ||
    {};

  for (const item of items) {
    if (
      deepCompare(columns, item.columns) &&
      deepCompare(options, item.options)
    ) {
      removeProp(context, prop, i);
    }
  }
};

const dropMatchingForeignKey = (
  context: ChangeContext,
  prop: ObjectLiteralElementLike,
  i: number,
  call: CallExpression,
  items: TableData.ForeignKey[],
) => {
  if (!items.length) return;

  const { arguments: args } = call;

  const columns = collectStringArrayFromCode(args[0]);
  if (!columns) return;

  const fnOrTableNode = args[1];
  let fnOrTable: string;
  if (ts.is.stringLiteral(fnOrTableNode)) {
    fnOrTable = fnOrTableNode.text;
  } else if (ts.is.arrowFunction(fnOrTableNode)) {
    fnOrTable = context.changes.content
      .slice(fnOrTableNode.pos, fnOrTableNode.end)
      .replaceAll(/\s/g, '');
  } else {
    return;
  }

  const foreignColumns = collectStringArrayFromCode(args[2]);
  if (!foreignColumns) return;

  const options =
    (ts.is.objectLiteral(args[3]) && collectObjectFromCode(args[3])) || {};

  for (const item of items) {
    const itemOptions = item.options;
    delete itemOptions.dropMode;

    if (
      deepCompare(columns, item.columns) &&
      deepCompare(fnOrTable, item.fnOrTable.toString()) &&
      deepCompare(foreignColumns, item.foreignColumns) &&
      deepCompare(options, itemOptions)
    ) {
      removeProp(context, prop, i);
    }
  }
};

const collectStringArrayFromCode = (node: Expression) => {
  if (!ts.is.arrayLiteral(node)) return;

  const result = node.elements
    .filter(ts.is.stringLiteral)
    .map((item) => item.text);

  return result.length === node.elements.length ? result : undefined;
};

const collectObjectFromCode = (node: ObjectLiteralExpression) => {
  const object: Record<string, string | number> = {};
  for (const prop of node.properties) {
    if (!ts.is.propertyAssignment(prop)) return;
    const name = ts.prop.getName(prop);
    if (!name) return;

    const init = prop.initializer;
    if (ts.is.stringLiteral(init)) {
      object[name] = init.text;
    } else if (ts.is.numericLiteral(init)) {
      object[name] = parseFloat(init.text);
    } else {
      return;
    }
  }
  return object;
};

const deepCompare = (a: unknown, b: unknown): boolean => {
  if (typeof a !== typeof b) return false;
  if (a === b) return true;
  if (typeof a === 'object') {
    if (a === null) return b === null;

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;

      return a.every((item, i) => deepCompare(item, b[i]));
    }

    for (const key in a) {
      if (
        !deepCompare(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      )
        return false;
    }

    for (const key in b as Record<string, unknown>) {
      if (!(key in a)) return false;
    }
  }
  return true;
};
