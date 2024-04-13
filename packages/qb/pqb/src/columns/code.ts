import { ColumnData, ColumnType, ForeignKey } from './columnType';
import { TableData } from './columnTypes';
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
  omit,
} from 'orchid-core';
import { getConstraintKind } from './columnType.utils';

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

  const { primaryKey, indexes, constraints } = tableData;
  if (primaryKey) {
    code.push(primaryKeyToCode(primaryKey, t));
  }

  if (indexes) {
    for (const index of indexes) {
      code.push(...indexToCode(index, t));
    }
  }

  if (constraints) {
    for (const item of constraints) {
      code.push(...constraintToCode(item, t));
    }
  }

  return code;
};

export const primaryKeyToCode = (
  primaryKey: TableData.PrimaryKey,
  t: string,
): string => {
  return `...${primaryKeyInnerToCode(primaryKey, t)},`;
};

export const primaryKeyInnerToCode = (
  primaryKey: TableData.PrimaryKey,
  t: string,
): string => {
  const name = primaryKey.options?.name;

  return `${t}.primaryKey([${primaryKey.columns.map(singleQuote).join(', ')}]${
    name ? `, { name: ${singleQuote(name)} }` : ''
  })`;
};

export const indexToCode = (index: TableData.Index, t: string): Code[] => {
  const code = indexInnerToCode(index, t);
  code[0] = `...${code[0]}`;
  const last = code[code.length - 1];
  if (typeof last === 'string' && !last.endsWith(',')) addCode(code, ',');
  return code;
};

export const indexInnerToCode = (index: TableData.Index, t: string): Code[] => {
  const code: Code[] = [];

  code.push(`${t}.${index.options.tsVector ? 'searchIndex' : 'index'}(`);

  const columnsMultiline = index.columns.some((column) => {
    for (const key in column) {
      if (key !== 'column' && column[key as keyof typeof column] !== undefined)
        return true;
    }
    return false;
  });
  if (columnsMultiline) {
    const objects: Code[] = [];

    for (const column of index.columns) {
      const expr = 'column' in column ? column.column : column.expression;

      let hasOptions = false;
      for (const key in column) {
        if (key !== 'column' && key !== 'expression') {
          hasOptions = true;
        }
      }

      if (!hasOptions) {
        objects.push(`${singleQuote(expr)},`);
      } else {
        const props: Code[] = [
          `${'column' in column ? 'column' : 'expression'}: ${singleQuote(
            expr,
          )},`,
        ];
        for (const key of ['collate', 'opclass', 'order', 'weight'] as const) {
          const value = column[key];
          if (value !== undefined) {
            props.push(`${key}: ${singleQuote(value)},`);
          }
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

  const indexOptions = omit(index.options, ['tsVector']);
  const hasOptions = objectHasValues(indexOptions);
  if (hasOptions) {
    if (columnsMultiline) {
      const columns = code[code.length - 1] as string[];
      columns[columns.length - 1] += ',';
      code.push(['{']);
    } else {
      addCode(code, ', {');
    }

    const options: string[] = [];
    for (const key in indexOptions) {
      const value = indexOptions[key as keyof typeof indexOptions];
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
): Code[] => {
  const code = constraintInnerToCode(item, t);
  code[0] = `...${code[0]}`;
  const last = code[code.length - 1];
  if (typeof last === 'string' && !last.endsWith(','))
    code[code.length - 1] += ',';
  return code;
};

export const constraintInnerToCode = (
  item: TableData.Constraint,
  t: string,
): Code[] => {
  const kind = getConstraintKind(item);

  if (kind === 'foreignKey' && item.references) {
    return [
      `${t}.foreignKey(`,
      referencesArgsToCode(item.references, item.name),
      '),',
    ];
  } else if (kind === 'check' && item.check) {
    return [`${t}.check(${item.check.toCode(t)})`];
  } else {
    return [`${t}.constraint({`, constraintPropsToCode(t, item), '}),'];
  }
};

export const constraintPropsToCode = (
  t: string,
  item: TableData.Constraint,
): Code[] => {
  const props: Code[] = [];

  if (item.name) {
    props.push(`name: ${singleQuote(item.name)},`);
  }

  if (item.references) {
    props.push(
      `references: [`,
      referencesArgsToCode(item.references, false),
      '],',
    );
  }

  if (item.check) {
    props.push(`check: ${item.check.toCode(t)},`);
  }

  return props;
};

export const referencesArgsToCode = (
  {
    columns,
    fnOrTable,
    foreignColumns,
    options,
  }: Exclude<TableData.Constraint['references'], undefined>,
  name: string | false = options?.name || false,
): Code[] => {
  const args: Code[] = [];

  args.push(`${singleQuoteArray(columns)},`);

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
    if (index.nullsNotDistinct) arr.push(`nullsNotDistinct: true,`);
    if (index.with) arr.push(`with: ${singleQuote(index.with)},`);
    if (index.tablespace)
      arr.push(`tablespace: ${singleQuote(index.tablespace)},`);
    if (index.where) arr.push(`where: ${singleQuote(index.where)},`);

    if (arr.length) {
      addCode(code, '{');
      addCode(code, arr);
      addCode(code, '}');
    }

    addCode(code, ')');
  }
  return code;
};

export const columnCheckToCode = (t: string, check: RawSQLBase): string => {
  return `.check(${check.toCode(t)})`;
};

export const identityToCode = (
  identity: TableData.Identity,
  dataType?: string,
) => {
  const code: Code[] = [];

  if (dataType === 'integer') {
    code.push(`identity(`);
  } else {
    code.push(`${dataType}().identity(`);
  }

  const props: string[] = [];
  if (identity.always) props.push(`always: true,`);
  if (identity.incrementBy) props.push(`incrementBy: ${identity.incrementBy},`);
  if (identity.startWith) props.push(`startWith: ${identity.startWith},`);
  if (identity.min) props.push(`min: ${identity.min},`);
  if (identity.max) props.push(`max: ${identity.max},`);
  if (identity.cache && identity.cache !== 1)
    props.push(`cache: ${identity.cache},`);

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

  if (data.isPrimaryKey) addCode(code, '.primaryKey()');

  if (data.foreignKeys) {
    for (const part of columnForeignKeysToCode(data.foreignKeys)) {
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

  if (data.default !== undefined) {
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
