import { Column } from './column';
import {
  emptyArray,
  emptyObject,
  objectHasValues,
  quoteObjectKey,
  RecordKeyTrue,
  RecordString,
  singleQuote,
  singleQuoteArray,
  toArray,
  toSnakeCase,
} from '../core/utils';
import { TableData } from '../tableData';
import {
  arrayMethodNames,
  ArrayMethodsDataForBaseColumn,
  BaseNumberData,
  DateColumnData,
  dateMethodNames,
  numberMethodNames,
  StringData,
  stringMethodNames,
} from './column-data-types';
import { isRawSQL, RawSQLBase } from '../core/raw';

// Type for composing code pieces for the code generation
export type Code = string | Codes;
export type Codes = Code[];

export interface ColumnToCodeCtx {
  t: string;
  table: string;
  currentSchema: string;
  migration?: boolean;
  snakeCase?: boolean;
}

/**
 * Push code: this will append a code string to the last code array element when possible.
 * @param code - array of code to push into
 * @param add - code to push
 */
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

/**
 * Convert the code item into string.
 *
 * @param code - code item
 * @param tabs - each new line will be prefixed with the tabs. Each element of the code represents a new line
 * @param shift - array elements of the given code will be shifted with this sting
 */
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

/**
 * Convert a column default value into code string.
 *
 * @param t - column types variable name
 * @param value - column default
 */
export const columnDefaultArgumentToCode = (
  t: string,
  value: unknown,
): string => {
  if (typeof value === 'object' && value && isRawSQL(value)) {
    return value.toCode(t);
  } else if (typeof value === 'function') {
    return value.toString();
  } else if (typeof value === 'string') {
    return singleQuote(value);
  } else {
    return JSON.stringify(value);
  }
};

/**
 * Build a function that will generate a code for a specific column type.
 *
 * @param methodNames - array of column method names to convert to code
 * @param skip - allows skipping some methods
 * @param aliases - provide aliases for specific methods
 */
export const columnMethodsToCode = <T extends Column.Data>(
  methodNames: (keyof T)[],
  skip?: RecordKeyTrue,
  aliases?: RecordString,
) => {
  return (
    data: T,
    migration: boolean | undefined,
    skipLocal?: RecordKeyTrue,
  ) => {
    return migration
      ? ''
      : methodNames
          .map((key) =>
            (skipLocal || skip)?.[key as string] ||
            (key === 'min' &&
              (data as { nonEmpty?: boolean }).nonEmpty &&
              (data as { min?: number }).min === 1)
              ? ''
              : columnMethodToCode(data, key, aliases?.[key as string]),
          )
          .join('');
  };
};

/**
 * Converts a single column method into code
 *
 * @param data - column `data` object that has info about applied methods
 * @param key - name of the method
 * @param name - optional alias for this method
 */
const columnMethodToCode = <T extends Column.Data, K extends keyof T>(
  data: T,
  key: K,
  name: string = key as string,
): string => {
  const param = data[key];
  if (param === undefined) return '';

  const error = data.errors?.[key as string];

  let params;
  if (typeof param === 'object' && param && param?.constructor === Object) {
    const props: string[] = [];
    for (const key in param) {
      if (key === 'message') continue;

      const value = (param as T)[key as keyof T];
      if (value !== undefined) {
        props.push(
          `${key}: ${typeof value === 'string' ? singleQuote(value) : value}`,
        );
      }
    }

    if (error) props.push(`message: ${singleQuote(error)}`);

    params = props.length ? `{ ${props.join(', ')} }` : '';
  } else {
    params =
      param === true
        ? ''
        : typeof param === 'string'
        ? singleQuote(param)
        : param instanceof Date
        ? `new Date('${param.toISOString()}')`
        : param;

    if (error) {
      if (param !== true) params += ', ';
      params += singleQuote(error);
    }
  }

  return `.${name}(${params})`;
};

// Function to encode string column methods
export const stringDataToCode =
  columnMethodsToCode<StringData>(stringMethodNames);

// Function to encode numeric column methods.
// `int` method is skipped because it's defined by the column type itself.
// Alias `lte` and `gte` to `max` and `min` for readability.
export const numberDataToCode = columnMethodsToCode<BaseNumberData>(
  numberMethodNames,
  undefined,
  { lte: 'max', gte: 'min' },
);

// Function to encode date column methods
export const dateDataToCode =
  columnMethodsToCode<DateColumnData>(dateMethodNames);
// Function to encode array column methods
export const arrayDataToCode =
  columnMethodsToCode<ArrayMethodsDataForBaseColumn>(arrayMethodNames);

/**
 * Converts column type and JSON type custom errors into code
 *
 * @param errors - custom error messages
 */
export const columnErrorMessagesToCode = (errors: RecordString): Code => {
  const props: Code[] = [];

  if (errors.required) {
    props.push(`required: ${singleQuote(errors.required)},`);
  }

  if (errors.invalidType) {
    props.push(`invalidType: ${singleQuote(errors.invalidType)},`);
  }

  const code: Code[] = [];

  if (!props.length) return code;

  addCode(code, '.error({');
  code.push(props);
  addCode(code, '})');

  return code;
};

export const isDefaultTimeStamp = (item: Column.Pick.DataAndDataType) => {
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
  ctx: ColumnToCodeCtx,
  shape: Column.Shape.QueryInit,
): Codes => {
  const hasTimestamps =
    'createdAt' in shape &&
    isDefaultTimeStamp(
      shape.createdAt as unknown as Column.Pick.DataAndDataType,
    ) &&
    'updatedAt' in shape &&
    isDefaultTimeStamp(
      shape.updatedAt as unknown as Column.Pick.DataAndDataType,
    );

  const code: Code = [];

  for (const key in shape) {
    if (hasTimestamps && (key === 'createdAt' || key === 'updatedAt')) continue;

    const column = shape[key];
    const name = column.data.name;
    if (name === key) column.data.name = undefined;

    code.push(
      ...combineCodeElements([
        `${quoteObjectKey(key, ctx.snakeCase)}: `,
        ...toArray((shape[key] as Column).toCode(ctx, key)),
        ',',
      ]),
    );

    if (name === key) column.data.name = name;
  }

  if (hasTimestamps) {
    code.push(`...${ctx.t}.timestamps(),`);
  }

  return code;
};

export const pushTableDataCode = (code: Codes, ast: TableData): Codes => {
  const lines: Codes[] = [
    ast.primaryKey && [primaryKeyInnerToCode(ast.primaryKey, 't') + ','],
    ...(ast.indexes?.map((x) => indexToCode(x, 't')) || emptyArray),
    ...(ast.excludes?.map((x) => excludeToCode(x, 't')) || emptyArray),
    ...(ast.constraints?.map((x) => constraintToCode(x, 't', true)) ||
      emptyArray),
  ].filter((x): x is string[] => !!x);

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

const indexOrExcludeToCode =
  <T extends TableData.Index | TableData.Exclude>(
    innerToCode: (item: T, t: string) => Codes,
  ) =>
  (item: T, t: string, prefix?: string) => {
    const code = innerToCode(item, t);
    if (prefix) code[0] = prefix + code[0];
    const last = code[code.length - 1];
    if (typeof last === 'string' && !last.endsWith(',')) addCode(code, ',');
    return code;
  };

export const indexInnerToCode = (index: TableData.Index, t: string): Codes => {
  const code: Codes = [
    `${t}.${
      index.options.tsVector
        ? 'searchIndex'
        : index.options.unique
        ? 'unique'
        : 'index'
    }(`,
  ];

  const columnOptions = ['collate', 'opclass', 'order', 'weight'] as const;

  const indexOptionsKeys: (undefined | keyof TableData.Index.Options)[] = [
    index.options.tsVector ? 'unique' : undefined,
    'name',
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
      const expr = 'expression' in column ? column.expression : column.column;

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
          `${'expression' in column ? 'expression' : 'column'}: ${singleQuote(
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

    code.push(['[', objects, hasOptions ? '],' : ']']);
  } else {
    addCode(
      code,
      `[${index.columns
        .map((it) => singleQuote((it as { column: string }).column))
        .join(', ')}]`,
    );
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

export const indexToCode = indexOrExcludeToCode(indexInnerToCode);

export const excludeInnerToCode = (
  item: TableData.Exclude,
  t: string,
): Codes => {
  const code: Codes = [`${t}.exclude(`];

  const columnOptions = ['collate', 'opclass', 'order', 'with'] as const;

  const optionsKeys: (undefined | keyof TableData.Exclude.Options)[] = [
    'name',
    'using',
    'include',
    'with',
    'tablespace',
    'where',
    'dropMode',
  ];

  const hasOptions = optionsKeys.some((key) => key && item.options[key]);

  const objects: Codes = [];

  for (const column of item.columns) {
    const expr = 'expression' in column ? column.expression : column.column;

    const props: Codes = [
      `${'expression' in column ? 'expression' : 'column'}: ${singleQuote(
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

  code.push(['[', objects, hasOptions ? '],' : ']']);

  if (hasOptions) {
    code.push(['{']);

    const options: string[] = [];
    for (const key of optionsKeys) {
      if (!key) continue;

      const value = item.options[key];
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

    code.push([options, '},']);
  }

  code.push('),');

  return code;
};

export const excludeToCode = indexOrExcludeToCode(excludeInnerToCode);

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
  items: Exclude<Column.Data['indexes'], undefined>,
): Codes => {
  const code: Codes = [];
  for (const { options } of items) {
    addCode(code, `.${options.unique ? 'unique' : 'index'}(`);

    const arr = [
      options.name && `name: ${singleQuote(options.name)},`,
      options.collate && `collate: ${singleQuote(options.collate)},`,
      options.opclass && `opclass: ${singleQuote(options.opclass)},`,
      options.order && `order: ${singleQuote(options.order)},`,
      options.using && `using: ${singleQuote(options.using)},`,
      options.include &&
        `include: ${
          typeof options.include === 'string'
            ? singleQuote(options.include)
            : `[${options.include.map(singleQuote).join(', ')}]`
        },`,
      options.nullsNotDistinct && `nullsNotDistinct: true,`,
      options.with && `with: ${singleQuote(options.with)},`,
      options.tablespace && `tablespace: ${singleQuote(options.tablespace)},`,
      options.where && `where: ${singleQuote(options.where)},`,
    ].filter((x): x is string => !!x);

    if (arr.length) {
      addCode(code, '{');
      addCode(code, arr);
      addCode(code, '}');
    }

    addCode(code, ')');
  }
  return code;
};

export const columnExcludesToCode = (
  items: Exclude<Column.Data['excludes'], undefined>,
): Codes => {
  const code: Codes = [];
  for (const { options, with: w } of items) {
    addCode(code, `.exclude('${w}'`);

    const arr = [
      options.name && `name: ${singleQuote(options.name)},`,
      options.collate && `collate: ${singleQuote(options.collate)},`,
      options.opclass && `opclass: ${singleQuote(options.opclass)},`,
      options.order && `order: ${singleQuote(options.order)},`,
      options.using && `using: ${singleQuote(options.using)},`,
      options.include &&
        `include: ${
          typeof options.include === 'string'
            ? singleQuote(options.include)
            : `[${options.include.map(singleQuote).join(', ')}]`
        },`,
      options.with && `with: ${singleQuote(options.with)},`,
      options.tablespace && `tablespace: ${singleQuote(options.tablespace)},`,
      options.where && `where: ${singleQuote(options.where)},`,
    ].filter((x): x is string => !!x);

    if (arr.length) {
      addCode(code, ', {');
      addCode(code, arr);
      addCode(code, '}');
    }

    addCode(code, ')');
  }
  return code;
};

export const columnCheckToCode = (
  ctx: ColumnToCodeCtx,
  checks: Column.Data.Check[],
): string => {
  return checks
    .map(
      ({ sql, name }) =>
        `.check(${sql.toCode(ctx.t)}${name ? `, '${name}'` : ''})`,
    )
    .join('');
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
  type: Column,
  ctx: ColumnToCodeCtx,
  key: string,
  code: Code,
): Code => {
  const { data } = type;

  code = toArray(code);

  let prepend = `${ctx.t}.`;
  const keyName = ctx.snakeCase ? toSnakeCase(key) : key;
  const name = data.name ?? keyName;
  if (name !== keyName) {
    prepend += `name(${singleQuote(name)}).`;
  }

  if (typeof code[0] === 'string') {
    code[0] = `${prepend}${code[0]}`;
  } else {
    code[0].unshift(prepend);
  }

  if (data.generated) {
    addCode(code, data.generated.toCode());
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
    for (const part of columnForeignKeysToCode(
      data.foreignKeys,
      ctx.migration,
    )) {
      addCode(code, part);
    }
  }

  if (data.explicitSelect) addCode(code, '.select(false)');

  if (data.isNullable) addCode(code, '.nullable()');

  if (data.as && !ctx.migration) {
    addCode(code, `.as(${(data.as as Column).toCode(ctx, key)})`);
  }

  if (
    data.default !== undefined &&
    data.default !== data.defaultDefault &&
    (!ctx.migration || typeof data.default !== 'function')
  ) {
    addCode(
      code,
      `.default(${columnDefaultArgumentToCode(ctx.t, data.default)})`,
    );
  }

  if (data.indexes) {
    for (const part of columnIndexesToCode(data.indexes)) {
      addCode(code, part);
    }
  }

  if (data.excludes) {
    for (const part of columnExcludesToCode(data.excludes)) {
      addCode(code, part);
    }
  }

  if (data.comment) addCode(code, `.comment(${singleQuote(data.comment)})`);

  if (data.checks) {
    addCode(code, columnCheckToCode(ctx, data.checks));
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
