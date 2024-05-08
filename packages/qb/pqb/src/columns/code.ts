import { ColumnData, ColumnType } from './columnType';
import {
  addCode,
  Code,
  columnDefaultArgumentToCode,
  columnErrorMessagesToCode,
  ColumnsShapeBase,
  ColumnTypeBase,
  objectHasValues,
  quoteObjectKey,
  singleQuote,
  singleQuoteArray,
  toArray,
  RawSQLBase,
  ColumnDataCheckBase,
  Codes,
  emptyObject,
} from 'orchid-core';
import { TableData } from '../tableData';

export const isDefaultTimeStamp = (item: ColumnTypeBase) => {
  if (item.dataType !== 'timestamptz') return false;

  const def = item.data.default;
  if (!(def instanceof RawSQLBase)) return false;

  return typeof def._sql === 'string' && def._sql.startsWith('now()');
};

const combineCodeElements = (input: Code): Code => {
  if (typeof input === 'string') return input;

  const output: Code = [];
  let i = -1;

  for (const item of input) {
    if (typeof item === 'string') {
      if (typeof output[i] === 'string') {
        output[i] += item;
      } else {
        output[++i] = item;
      }
    } else {
      output[++i] = combineCodeElements(item);
    }
  }

  return output;
};

export const columnsShapeToCode = (
  shape: ColumnsShapeBase,
  t: string,
): Codes => {
  const hasTimestamps =
    'createdAt' in shape &&
    isDefaultTimeStamp(shape.createdAt) &&
    'updatedAt' in shape &&
    isDefaultTimeStamp(shape.updatedAt);

  const code: Code = [];

  for (const key in shape) {
    if (hasTimestamps && (key === 'createdAt' || key === 'updatedAt')) continue;

    code.push(
      ...combineCodeElements([
        `${quoteObjectKey(key)}: `,
        ...toArray(shape[key].toCode(t)),
        ',',
      ]),
    );
  }

  if (hasTimestamps) {
    code.push(`...${t}.timestamps(),`);
  }

  return code;
};

export const pushTableDataCode = (code: Codes, ast: TableData): Codes => {
  const lines: Codes[] = [];

  if (ast.primaryKey) {
    lines.push([primaryKeyInnerToCode(ast.primaryKey, 't') + ',']);
  }

  if (ast.indexes) {
    for (const index of ast.indexes) {
      lines.push(indexToCode(index, 't'));
    }
  }

  if (ast.constraints) {
    for (const constraint of ast.constraints) {
      lines.push(constraintToCode(constraint, 't', true));
    }
  }

  if (lines.length > 1) {
    code.push('(t) => [', ...lines, '],');
  } else if (lines[0].length === 1 && typeof lines[0][0] === 'string') {
    code.push('(t) => ' + lines[0][0]);
  } else {
    code.push('(t) => ', lines[0]);
  }

  return code;
};

export const primaryKeyInnerToCode = (
  primaryKey: TableData.PrimaryKey,
  t: string,
): string => {
  const name = primaryKey.name;

  return `${t}.primaryKey([${primaryKey.columns.map(singleQuote).join(', ')}]${
    name ? `, ${singleQuote(name)}` : ''
  })`;
};

export const indexToCode = (
  index: TableData.Index,
  t: string,
  prefix?: string,
): Codes => {
  const code = indexInnerToCode(index, t);
  if (prefix) code[0] = prefix + code[0];
  const last = code[code.length - 1];
  if (typeof last === 'string' && !last.endsWith(',')) addCode(code, ',');
  return code;
};

export const indexInnerToCode = (index: TableData.Index, t: string): Codes => {
  const code: Codes = [];

  code.push(
    `${t}.${
      index.options.tsVector
        ? 'searchIndex'
        : index.options.unique
        ? 'unique'
        : 'index'
    }(`,
  );

  const columnOptions = ['collate', 'opclass', 'order', 'weight'] as const;

  const indexOptionsKeys: (undefined | keyof TableData.Index.Options)[] = [
    index.options.tsVector ? 'unique' : undefined,
    'using',
    'nullsNotDistinct',
    'include',
    'with',
    'tablespace',
    'where',
    'language',
    'languageColumn',
    'dropMode',
  ];

  const hasOptions = indexOptionsKeys.some((key) => key && index.options[key]);

  const columnsMultiline = index.columns.some((column) => {
    for (const key in column) {
      if (key !== 'column' && column[key as keyof typeof column] !== undefined)
        return true;
    }
    return false;
  });

  if (columnsMultiline) {
    const objects: Codes = [];

    for (const column of index.columns) {
      const expr = 'column' in column ? column.column : column.expression;

      let hasOptions = false;
      for (const key in column) {
        if (key !== 'column') {
          hasOptions = true;
        }
      }

      if (!hasOptions) {
        objects.push(`${singleQuote(expr)},`);
      } else {
        const props: Codes = [
          `${'column' in column ? 'column' : 'expression'}: ${singleQuote(
            expr,
          )},`,
        ];
        for (const key of columnOptions) {
          const value = column[key];
          if (value !== undefined) {
            props.push(`${key}: ${singleQuote(value)},`);
          }
        }

        objects.push('{', props, '},');
      }
    }

    code.push(['[', objects, hasOptions || index.name ? '],' : ']']);

    if (index.name) {
      addCode(code, `  ${singleQuote(index.name)},`);
    }
  } else {
    addCode(
      code,
      `[${index.columns
        .map((it) => singleQuote((it as { column: string }).column))
        .join(', ')}]`,
    );

    if (index.name) {
      addCode(code, `, ${singleQuote(index.name)}`);
    }
  }

  if (hasOptions) {
    if (columnsMultiline) {
      code.push(['{']);
    } else {
      addCode(code, ', {');
    }

    const options: string[] = [];
    for (const key of indexOptionsKeys) {
      if (!key) continue;

      const value = index.options[key];
      if (value === null || value === undefined) continue;

      options.push(
        `${key}: ${
          Array.isArray(value)
            ? singleQuoteArray(value)
            : typeof value === 'string'
            ? singleQuote(value)
            : value
        },`,
      );
    }

    if (columnsMultiline) {
      code.push([options, '},']);
    } else {
      code.push(options);
      addCode(code, '}');
    }
  }

  if (columnsMultiline) {
    code.push('),');
  } else {
    addCode(code, ')');
  }

  return code;
};

export const constraintToCode = (
  item: TableData.Constraint,
  t: string,
  m?: boolean,
  prefix?: string,
): Codes => {
  const code = constraintInnerToCode(item, t, m);
  if (prefix) code[0] = prefix + code[0];
  const last = code[code.length - 1];
  if (typeof last === 'string' && !last.endsWith(','))
    code[code.length - 1] += ',';
  return code;
};

export const constraintInnerToCode = (
  item: TableData.Constraint,
  t: string,
  m?: boolean,
): Codes => {
  if (item.references) {
    return [
      `${t}.foreignKey(`,
      referencesArgsToCode(item.references, item.name, m),
      '),',
    ];
  }

  return [
    `${t}.check(${(item.check as TableData.Check).toCode(t)}${
      item.name ? `, ${singleQuote(item.name)}` : ''
    })`,
  ];
};

export const referencesArgsToCode = (
  {
    columns,
    fnOrTable,
    foreignColumns,
    options,
  }: Exclude<TableData.Constraint['references'], undefined>,
  name: string | false = options?.name || false,
  m?: boolean,
): Codes => {
  const args: Codes = [];

  args.push(`${singleQuoteArray(columns)},`);

  if (m && typeof fnOrTable !== 'string') {
    const { schema, table } = new (fnOrTable())();
    fnOrTable = schema ? `${schema}.${table}` : table;
  }

  args.push(
    `${
      typeof fnOrTable === 'string'
        ? singleQuote(fnOrTable)
        : fnOrTable.toString()
    },`,
  );

  args.push(`${singleQuoteArray(foreignColumns)},`);

  if (objectHasValues(options) || name) {
    const lines: string[] = [];
    if (name) lines.push(`name: ${singleQuote(name)},`);
    for (const key in options) {
      if (key === 'name') continue;
      const value = options[key as keyof typeof options];
      if (value) lines.push(`${key}: ${singleQuote(value)},`);
    }
    args.push('{', lines, '},');
  }

  return args;
};

export const columnForeignKeysToCode = (
  foreignKeys: TableData.ColumnReferences[],
  migration: boolean | undefined,
): Codes => {
  const code: Codes = [];
  for (const foreignKey of foreignKeys) {
    addCode(code, `.foreignKey(`);
    for (const part of foreignKeyArgumentToCode(foreignKey, migration)) {
      addCode(code, part);
    }
    addCode(code, ')');
  }
  return code;
};

export const foreignKeyArgumentToCode = (
  {
    fnOrTable,
    foreignColumns,
    options = emptyObject,
  }: TableData.ColumnReferences,
  migration: boolean | undefined,
): Codes => {
  const code: Code = [];

  if (migration && typeof fnOrTable !== 'string') {
    const { schema, table } = new (fnOrTable())();
    fnOrTable = schema ? `${schema}.${table}` : table;
  }

  code.push(
    typeof fnOrTable === 'string'
      ? singleQuote(fnOrTable)
      : fnOrTable.toString(),
  );

  addCode(code, `, ${singleQuote(foreignColumns[0])}`);

  const hasOptions =
    options.name || options.match || options.onUpdate || options.onDelete;

  if (hasOptions) {
    const arr: string[] = [];

    if (options.name) arr.push(`name: ${singleQuote(options.name)},`);
    if (options.match) arr.push(`match: ${singleQuote(options.match)},`);
    if (options.onUpdate)
      arr.push(`onUpdate: ${singleQuote(options.onUpdate)},`);
    if (options.onDelete)
      arr.push(`onDelete: ${singleQuote(options.onDelete)},`);

    addCode(code, ', {');
    code.push(arr);
    addCode(code, '}');
  }

  return code;
};

export const columnIndexesToCode = (
  indexes: Exclude<ColumnData['indexes'], undefined>,
): Codes => {
  const code: Codes = [];
  for (const { options, name } of indexes) {
    addCode(code, `.${options.unique ? 'unique' : 'index'}(`);

    const arr: string[] = [];

    if (options.collate) arr.push(`collate: ${singleQuote(options.collate)},`);
    if (options.opclass) arr.push(`opclass: ${singleQuote(options.opclass)},`);
    if (options.order) arr.push(`order: ${singleQuote(options.order)},`);
    if (name) arr.push(`name: ${singleQuote(name)},`);
    if (options.using) arr.push(`using: ${singleQuote(options.using)},`);
    if (options.include)
      arr.push(
        `include: ${
          typeof options.include === 'string'
            ? singleQuote(options.include)
            : `[${options.include.map(singleQuote).join(', ')}]`
        },`,
      );
    if (options.nullsNotDistinct) arr.push(`nullsNotDistinct: true,`);
    if (options.with) arr.push(`with: ${singleQuote(options.with)},`);
    if (options.tablespace)
      arr.push(`tablespace: ${singleQuote(options.tablespace)},`);
    if (options.where) arr.push(`where: ${singleQuote(options.where)},`);

    if (arr.length) {
      addCode(code, '{');
      addCode(code, arr);
      addCode(code, '}');
    }

    addCode(code, ')');
  }
  return code;
};

export const columnCheckToCode = (
  t: string,
  { sql, name }: ColumnDataCheckBase,
): string => {
  return `.check(${sql.toCode(t)}${name ? `, { name: '${name}' }` : ''})`;
};

export const identityToCode = (
  identity: TableData.Identity,
  dataType?: string,
) => {
  const code: Codes = [];

  if (dataType === 'integer') {
    code.push(`identity(`);
  } else {
    code.push(`${dataType}().identity(`);
  }

  const props: string[] = [];
  if (identity.always) props.push(`always: true,`);
  if (identity.increment && identity.increment !== 1)
    props.push(`increment: ${identity.increment},`);
  if (identity.start && identity.start !== 1)
    props.push(`start: ${identity.start},`);
  if (identity.min) props.push(`min: ${identity.min},`);
  if (identity.max) props.push(`max: ${identity.max},`);
  if (identity.cache && identity.cache !== 1)
    props.push(`cache: ${identity.cache},`);
  if (identity.cycle) props.push(`cycle: true,`);

  if (props.length) {
    addCode(code, '{');
    code.push(props, '}');
  }

  addCode(code, ')');

  return code;
};

export const columnCode = (
  type: ColumnType,
  t: string,
  code: Code,
  migration: boolean | undefined,
  data = type.data,
  skip?: { encodeFn: unknown },
): Code => {
  code = toArray(code);

  let prepend = `${t}.`;
  if (data.name) {
    prepend += `name(${singleQuote(data.name)}).`;
  }

  if (typeof code[0] === 'string') {
    code[0] = `${prepend}${code[0]}`;
  } else {
    code[0].unshift(prepend);
  }

  if (data.primaryKey) {
    addCode(
      code,
      `.primaryKey(${
        data.primaryKey === (true as never) ? '' : singleQuote(data.primaryKey)
      })`,
    );
  }

  if (data.foreignKeys) {
    for (const part of columnForeignKeysToCode(data.foreignKeys, migration)) {
      addCode(code, part);
    }
  }

  if (data.isHidden) addCode(code, '.hidden()');

  if (data.isNullable) addCode(code, '.nullable()');

  if (type.encodeFn && type.encodeFn !== skip?.encodeFn)
    addCode(code, `.encode(${type.encodeFn.toString()})`);

  if (type.parseFn && !('hideFromCode' in type.parseFn))
    addCode(code, `.parse(${type.parseFn.toString()})`);

  if (data.as) addCode(code, `.as(${data.as.toCode(t)})`);

  if (
    data.default !== undefined &&
    (!migration || typeof data.default !== 'function')
  ) {
    addCode(code, `.default(${columnDefaultArgumentToCode(t, data.default)})`);
  }

  if (data.indexes) {
    for (const part of columnIndexesToCode(data.indexes)) {
      addCode(code, part);
    }
  }

  if (data.comment) addCode(code, `.comment(${singleQuote(data.comment)})`);

  if (data.check) {
    addCode(code, columnCheckToCode(t, data.check));
  }

  if (data.errors) {
    for (const part of columnErrorMessagesToCode(data.errors)) {
      addCode(code, part);
    }
  }

  const { validationDefault } = data;
  if (validationDefault) {
    addCode(
      code,
      `.validationDefault(${
        typeof validationDefault === 'function'
          ? validationDefault.toString()
          : typeof validationDefault === 'string'
          ? singleQuote(validationDefault)
          : JSON.stringify(validationDefault)
      })`,
    );
  }

  if (data.compression)
    addCode(code, `.compression(${singleQuote(data.compression)})`);

  if (data.collate) addCode(code, `.collate(${singleQuote(data.collate)})`);

  if (data.modifyQuery)
    addCode(code, `.modifyQuery(${data.modifyQuery.toString()})`);

  return code.length === 1 && typeof code[0] === 'string' ? code[0] : code;
};
