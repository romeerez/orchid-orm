import { ColumnsShape } from './columnsSchema';
import { ColumnChain, ColumnData, ColumnType, ForeignKey } from './columnType';
import { TimestampColumn } from './dateTime';
import { getRaw, isRaw } from '../raw';
import {
  quoteObjectKey,
  singleQuote,
  singleQuoteArray,
  toArray,
} from '../utils';
import { TableData } from './columnTypes';

export type Code = string | Code[];

export const addCode = (code: Code[], add: Code) => {
  if (typeof add === 'object') {
    code.push(add);
  } else {
    const last = code.length - 1;
    if (typeof code[last] === 'string') {
      code[last] = code[last] + add;
    } else {
      code.push(add);
    }
  }
};

export const codeToString = (
  code: Code,
  tabs: string,
  shift: string,
): string => {
  if (typeof code === 'string') return `${tabs}${code}`;

  const lines: string[] = [];
  for (const item of code) {
    if (typeof item === 'string') {
      lines.push(`${tabs}${item}`);
    } else {
      lines.push(codeToString(item, tabs + shift, shift));
    }
  }

  return lines.length ? lines.join('\n') : '';
};

const isDefaultTimeStamp = (item: ColumnType) => {
  if (!(item instanceof TimestampColumn)) return false;

  const def = item.data.default;
  return def && isRaw(def) && getRaw(def, []) === 'now()';
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
  shape: ColumnsShape,
  tableData: TableData,
  t: string,
): Code[] => {
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

  const { primaryKey, indexes, foreignKeys } = tableData;
  if (primaryKey) {
    code.push(primaryKeyToCode(primaryKey, t));
  }

  for (const index of indexes) {
    code.push(...indexToCode(index, t));
  }

  for (const foreignKey of foreignKeys) {
    code.push(...foreignKeyToCode(foreignKey, t));
  }

  return code;
};

export const primaryKeyToCode = (
  primaryKey: TableData.PrimaryKey,
  t: string,
): string => {
  const name = primaryKey.options?.name;

  return `...${t}.primaryKey([${primaryKey.columns
    .map(singleQuote)
    .join(', ')}]${name ? `, { name: ${singleQuote(name)} }` : ''}),`;
};

export const indexToCode = (index: TableData.Index, t: string): Code[] => {
  const code: Code[] = [];

  code.push(`...${t}.index(`);

  const columnsMultiline = index.columns.some(
    (column) => Object.keys(column).length > 1 || 'expression' in column,
  );
  if (columnsMultiline) {
    const objects: Code[] = [];

    for (const column of index.columns) {
      const expr = 'column' in column ? column.column : column.expression;
      if (Object.keys(column).length === 1) {
        objects.push(`${singleQuote(expr)},`);
      } else {
        const props: Code[] = [
          `${'column' in column ? 'column' : 'expression'}: ${singleQuote(
            expr,
          )},`,
        ];
        if (column.collate !== undefined) {
          props.push(`collate: ${singleQuote(column.collate)},`);
        }
        if (column.opclass !== undefined) {
          props.push(`opclass: ${singleQuote(column.opclass)},`);
        }
        if (column.order !== undefined) {
          props.push(`order: ${singleQuote(column.order)},`);
        }

        objects.push('{', props, '},');
      }
    }

    code.push(['[', objects, ']']);
  } else {
    addCode(
      code,
      `[${index.columns
        .map((it) => singleQuote((it as { column: string }).column))
        .join(', ')}]`,
    );
  }

  const optionsKeys = Object.keys(index.options);
  const hasOptions = optionsKeys.length > 0;
  if (hasOptions) {
    if (columnsMultiline) {
      const columns = code[code.length - 1] as string[];
      columns[columns.length - 1] += ',';
      code.push(['{']);
    } else {
      addCode(code, ', {');
    }

    const options: string[] = [];
    for (const key of optionsKeys) {
      const value = index.options[key as keyof typeof index.options];
      if (value === null || value === undefined) continue;

      options.push(
        `${key}: ${
          typeof value === 'object'
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
    addCode(code, '),');
  }

  return code;
};

export const foreignKeyToCode = (
  foreignKey: TableData.ForeignKey,
  t: string,
): Code[] => {
  return [`...${t}.foreignKey(`, foreignKeyArgsToCode(foreignKey), '),'];
};

export const foreignKeyArgsToCode = (
  foreignKey: TableData.ForeignKey,
): Code[] => {
  const args: Code[] = [];

  args.push(`${singleQuoteArray(foreignKey.columns)},`);

  args.push(
    `${
      typeof foreignKey.fnOrTable === 'string'
        ? singleQuote(foreignKey.fnOrTable)
        : foreignKey.fnOrTable.toString()
    },`,
  );

  args.push(`${singleQuoteArray(foreignKey.foreignColumns)},`);

  const { options } = foreignKey;
  if (Object.keys(foreignKey.options).length > 0) {
    const lines: string[] = [];
    for (const key in foreignKey.options) {
      lines.push(
        `${key}: ${singleQuote(
          options[key as keyof typeof options] as string,
        )},`,
      );
    }
    args.push('{', lines, '},');
  }

  return args;
};

export const columnChainToCode = (
  chain: ColumnChain,
  t: string,
  code: Code,
): Code => {
  const result = toArray(code) as Code[];

  for (const item of chain) {
    if (item[0] === 'transform') {
      addCode(result, `.transform(${item[1].toString()})`);
    } else if (item[0] === 'to') {
      addCode(result, `.to(${item[1].toString()}, `);
      addCode(result, item[2].toCode(t));
      addCode(result, ')');
    } else if (item[0] === 'refine') {
      addCode(result, `.refine(${item[1].toString()})`);
    } else if (item[0] === 'superRefine') {
      addCode(result, `.superRefine(${item[1].toString()})`);
    }
  }

  return result.length === 1 && typeof result[0] === 'string'
    ? result[0]
    : result;
};

export const columnDefaultArgumentToCode = (value: unknown): string => {
  return typeof value === 'object' && value && isRaw(value)
    ? `${singleQuote(value.__raw)}, ${JSON.stringify(value.__values)}`
    : typeof value === 'string'
    ? singleQuote(value)
    : JSON.stringify(value);
};

export const columnForeignKeysToCode = (
  foreignKeys: ForeignKey<string, string[]>[],
): Code[] => {
  const code: Code[] = [];
  for (const foreignKey of foreignKeys) {
    addCode(code, `.foreignKey(`);
    for (const part of foreignKeyArgumentToCode(foreignKey)) {
      addCode(code, part);
    }
    addCode(code, ')');
  }
  return code;
};

export const foreignKeyArgumentToCode = (
  foreignKey: ForeignKey<string, string[]>,
): Code[] => {
  const code: Code = [];

  if ('fn' in foreignKey) {
    code.push(foreignKey.fn.toString());
  } else {
    code.push(singleQuote(foreignKey.table));
  }
  addCode(code, `, ${singleQuote(foreignKey.columns[0])}`);

  const hasOptions =
    foreignKey.name ||
    foreignKey.match ||
    foreignKey.onUpdate ||
    foreignKey.onDelete;

  if (hasOptions) {
    const arr: string[] = [];

    if (foreignKey.name) arr.push(`name: ${singleQuote(foreignKey.name)},`);
    if (foreignKey.match) arr.push(`match: ${singleQuote(foreignKey.match)},`);
    if (foreignKey.onUpdate)
      arr.push(`onUpdate: ${singleQuote(foreignKey.onUpdate)},`);
    if (foreignKey.onDelete)
      arr.push(`onDelete: ${singleQuote(foreignKey.onDelete)},`);

    addCode(code, ', {');
    code.push(arr);
    addCode(code, '}');
  }

  return code;
};

export const columnIndexesToCode = (
  indexes: Exclude<ColumnData['indexes'], undefined>,
): Code[] => {
  const code: Code[] = [];
  for (const index of indexes) {
    addCode(code, `.${index.unique ? 'unique' : 'index'}(`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const key in index) {
      if (key === 'unique') continue;

      const arr: string[] = [];

      if (index.collate) arr.push(`collate: ${singleQuote(index.collate)},`);
      if (index.opclass) arr.push(`opclass: ${singleQuote(index.opclass)},`);
      if (index.order) arr.push(`order: ${singleQuote(index.order)},`);
      if (index.name) arr.push(`name: ${singleQuote(index.name)},`);
      if (index.using) arr.push(`using: ${singleQuote(index.using)},`);
      if (index.include)
        arr.push(
          `include: ${
            typeof index.include === 'string'
              ? singleQuote(index.include)
              : `[${index.include.map(singleQuote).join(', ')}]`
          },`,
        );
      if (index.with) arr.push(`with: ${singleQuote(index.with)},`);
      if (index.tablespace)
        arr.push(`tablespace: ${singleQuote(index.tablespace)},`);
      if (index.where) arr.push(`where: ${singleQuote(index.where)},`);

      addCode(code, '{');
      addCode(code, arr);
      addCode(code, '}');
      break;
    }

    addCode(code, ')');
  }
  return code;
};

export const columnCode = (type: ColumnType, t: string, code: Code): Code => {
  code = toArray(code);

  if (type.isPrimaryKey) addCode(code, '.primaryKey()');

  if (type.data.foreignKeys) {
    for (const part of columnForeignKeysToCode(type.data.foreignKeys)) {
      addCode(code, part);
    }
  }

  if (type.isHidden) addCode(code, '.hidden()');

  if (type.data.isNullable) addCode(code, '.nullable()');

  if ('isNonEmpty' in type.data) addCode(code, '.nonEmpty()');

  if (type.encodeFn) addCode(code, `.encode(${type.encodeFn.toString()})`);

  if (type.parseFn && !('hideFromCode' in type.parseFn))
    addCode(code, `.parse(${type.parseFn.toString()})`);

  if (type.data.as) addCode(code, `.as(${type.data.as.toCode(t)})`);

  if (type.data.default)
    addCode(
      code,
      `.default(${columnDefaultArgumentToCode(type.data.default)})`,
    );

  if (type.data.indexes) {
    for (const part of columnIndexesToCode(type.data.indexes)) {
      addCode(code, part);
    }
  }

  if (type.data.comment)
    addCode(code, `.comment(${singleQuote(type.data.comment)})`);

  const { validationDefault } = type.data;
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

  if (type.data.compression)
    addCode(code, `.compression(${singleQuote(type.data.compression)})`);

  if (type.data.collate)
    addCode(code, `.collate(${singleQuote(type.data.collate)})`);

  if (type.data.modifyQuery)
    addCode(code, `.modifyQuery(${type.data.modifyQuery.toString()})`);

  return columnChainToCode(type.chain, t, code);
};
