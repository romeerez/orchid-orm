import {
  parseTableDataInput,
  escapeString,
  UnknownColumn,
  consumeColumnName,
  setCurrentColumnName,
  setDefaultLanguage,
  Column,
  EnumColumn,
  DomainColumn,
  TableData,
  TableDataMethods,
  tableDataMethods,
  ArrayColumn,
  deepCompare,
  EmptyObject,
  NonUniqDataItem,
  RecordKeyTrue,
  RecordUnknown,
  toArray,
  toSnakeCase,
  type QuerySchema,
  RawSqlBase,
} from 'pqb/internal';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  DropMode,
  Migration,
  MigrationColumnTypes,
} from './migration';
import { RakeDbAst } from '../ast';
import {
  getSchemaAndTableFromName,
  makePopulateEnumQuery,
  quoteCustomType,
  quoteNameFromString,
  quoteWithSchema,
} from '../common';
import {
  addColumnComment,
  addColumnExclude,
  addColumnIndex,
  cmpRawSql,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  encodeColumnDefault,
  excludesToQuery,
  getColumnName,
  identityToSql,
  indexesToQuery,
  interpolateSqlValues,
  nameColumnChecks,
  primaryKeyToSql,
} from './migration.utils';
import { TableMethods, tableMethods } from './table-methods';
import { TableQuery } from './create-table';

interface ChangeTableData {
  add: TableData;
  drop: TableData;
}

const newChangeTableData = (): ChangeTableData => ({
  add: {},
  drop: {},
});

let changeTableData = newChangeTableData();

const resetChangeTableData = () => {
  changeTableData = newChangeTableData();
};

const addOrDropChanges: (
  | RakeDbAst.ChangeTableItem.Column
  | RakeDbAst.ChangeTableItem.Change
)[] = [];
const standaloneCheckChanges: {
  index: number;
  type: 'add' | 'drop';
  item: CheckConstraintItem;
}[] = [];

type Add = typeof add;
// add column
function add(item: Column, options?: { dropMode?: DropMode }): SpecialChange;
// add primary key, index, etc
function add(emptyObject: EmptyObject): SpecialChange;
// add timestamps
function add(
  items: Record<string, Column>,
  options?: { dropMode?: DropMode },
): Record<string, RakeDbAst.ChangeTableItem.Column>;
function add(
  this: TableChangeMethods,
  item: Column | EmptyObject | Record<string, Column>,
  options?: { dropMode?: DropMode },
): undefined | EmptyObject | Record<string, RakeDbAst.ChangeTableItem.Column> {
  consumeColumnName();
  setName(this, item);

  if (item instanceof Column) {
    const result = addOrDrop('add', item, options);
    if (result.type === 'change') {
      result.name ??= getName(this);
      return result;
    }
    addOrDropChanges.push(result);
    return (addOrDropChanges.length - 1) as unknown as EmptyObject;
  }

  if (isStandaloneAddOrDropInput(item)) {
    const result = standaloneAddOrDropToChange('add', item);
    result.name ??= getName(this);
    addOrDropChanges.push(result);
    return (addOrDropChanges.length - 1) as unknown as EmptyObject;
  }

  if (isStandaloneCheckAddOrDropInput(item)) {
    const result = standaloneAddOrDropToChange('add', item);
    result.name ??= getName(this);
    addOrDropChanges.push(result);
    standaloneCheckChanges.push({
      index: addOrDropChanges.length - 1,
      type: 'add',
      item,
    });
    return (addOrDropChanges.length - 1) as unknown as EmptyObject;
  }

  for (const key in item) {
    // ...t.timestamps() case
    if (
      (item as Record<string, RakeDbAst.ChangeTableItem.Column>)[key] instanceof
      Column
    ) {
      const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
      for (const key in item) {
        result[key] = {
          type: 'add',
          item: (item as Record<string, Column>)[key],
          dropMode: options?.dropMode,
        };
      }
      return result;
    }

    parseTableDataInput(changeTableData.add, item);
    break;
  }

  return undefined as never;
}

const drop = function (this: TableChangeMethods, item, options) {
  consumeColumnName();
  setName(this, item);

  if (item instanceof Column) {
    const result = addOrDrop('drop', item, options);
    if (result.type === 'change') {
      result.name ??= getName(this);
      return result;
    }
    addOrDropChanges.push(result);
    return addOrDropChanges.length - 1;
  }

  if (isStandaloneAddOrDropInput(item)) {
    const result = standaloneAddOrDropToChange('drop', item);
    result.name ??= getName(this);
    addOrDropChanges.push(result);
    return addOrDropChanges.length - 1;
  }

  if (isStandaloneCheckAddOrDropInput(item)) {
    const result = standaloneAddOrDropToChange('drop', item);
    result.name ??= getName(this);
    addOrDropChanges.push(result);
    standaloneCheckChanges.push({
      index: addOrDropChanges.length - 1,
      type: 'drop',
      item,
    });
    return addOrDropChanges.length - 1;
  }

  for (const key in item) {
    // ...t.timestamps() case
    if (
      (item as unknown as Record<string, RakeDbAst.ChangeTableItem.Column>)[
        key
      ] instanceof Column
    ) {
      const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
      for (const key in item) {
        result[key] = {
          type: 'drop',
          item: (item as Record<string, Column>)[key],
          dropMode: options?.dropMode,
        };
      }
      return result;
    }

    parseTableDataInput(changeTableData.drop, item);
    break;
  }

  return undefined as never;
} as Add;

const addOrDrop = (
  type: 'add' | 'drop',
  item: Column,
  options?: { dropMode?: DropMode },
): RakeDbAst.ChangeTableItem.Column | RakeDbAst.ChangeTableItem.Change => {
  if (item instanceof UnknownColumn) {
    const empty = columnTypeToColumnChange({
      type: 'change',
      to: {},
    });
    const add = columnTypeToColumnChange({
      type: 'change',
      to: {
        checks: item.data.checks,
      },
    });

    return {
      type: 'change',
      from: type === 'add' ? empty : add,
      to: type === 'add' ? add : empty,
      ...options,
    };
  }

  return {
    type,
    item,
    dropMode: options?.dropMode,
  };
};

const standaloneAddOrDropToChange = (
  type: 'add' | 'drop',
  item:
    | ColumnForeignKeyChangeInput
    | ColumnPrimaryKeyChangeInput
    | ColumnIndexChangeInput
    | ColumnExcludeChangeInput
    | CheckConstraintItem,
): RakeDbAst.ChangeTableItem.Change => {
  const empty = columnTypeToColumnChange({
    type: 'change',
    to: {},
  });
  const change = changeInputToColumnChange(item);

  return {
    type: 'change',
    from: type === 'add' ? empty : change,
    to: type === 'add' ? change : empty,
  };
};

interface Change extends RakeDbAst.ChangeTableItem.Change, ChangeOptions {}

type ChangeOptions = RakeDbAst.ChangeTableItem.ChangeUsing;

interface SpecialChange {
  type: SpecialChange;
}

interface OneWayChange {
  type: 'change';
  name?: string;
  to: RakeDbAst.ColumnChange;
  using?: RakeDbAst.ChangeTableItem.ChangeUsing;
}

interface ColumnForeignKeyChangeInput {
  columnForeignKey: TableData.ColumnReferences;
}

interface ColumnPrimaryKeyChangeInput {
  columnPrimaryKey: {
    name?: string;
  };
}

interface ColumnIndexChangeInput {
  columnIndex: TableData.ColumnIndex;
}

interface ColumnExcludeChangeInput {
  columnExclude: TableData.ColumnExclude;
}

type ChangeInput =
  | Column
  | OneWayChange
  | NonUniqDataItem
  | ColumnForeignKeyChangeInput
  | ColumnPrimaryKeyChangeInput
  | ColumnIndexChangeInput
  | ColumnExcludeChangeInput;

const isColumnForeignKeyChangeInput = (
  item: ChangeInput,
): item is ColumnForeignKeyChangeInput => {
  return 'columnForeignKey' in item;
};

const isColumnPrimaryKeyChangeInput = (
  item: ChangeInput,
): item is ColumnPrimaryKeyChangeInput => {
  return 'columnPrimaryKey' in item;
};

const isColumnIndexChangeInput = (
  item: ChangeInput,
): item is ColumnIndexChangeInput => {
  return 'columnIndex' in item;
};

const isColumnExcludeChangeInput = (
  item: ChangeInput,
): item is ColumnExcludeChangeInput => {
  return 'columnExclude' in item;
};

const isStandaloneAddOrDropInput = (
  item: EmptyObject | Record<string, Column>,
): item is
  | ColumnForeignKeyChangeInput
  | ColumnPrimaryKeyChangeInput
  | ColumnIndexChangeInput
  | ColumnExcludeChangeInput => {
  return (
    isColumnForeignKeyChangeInput(item as ChangeInput) ||
    isColumnPrimaryKeyChangeInput(item as ChangeInput) ||
    isColumnIndexChangeInput(item as ChangeInput) ||
    isColumnExcludeChangeInput(item as ChangeInput)
  );
};

const isStandaloneCheckAddOrDropInput = (
  item: EmptyObject | Record<string, Column>,
): item is CheckConstraintItem => {
  return isCheckConstraintItem(item as unknown as NonUniqDataItem);
};

type TableDataForeignKeyArgs =
  | [
      columns: [string, ...string[]],
      fnOrTable: () => new () => { columns: { shape: unknown } },
      foreignColumns: [PropertyKey, ...PropertyKey[]],
      options?: TableData.References.Options,
    ]
  | [
      columns: [string, ...string[]],
      fnOrTable: string,
      foreignColumns: [string, ...string[]],
      options?: TableData.References.Options,
    ];

type ColumnForeignKeyArgs = [
  fnOrTable: string,
  foreignColumn: string,
  options?: TableData.References.Options,
];

interface CheckConstraintItem extends NonUniqDataItem {
  constraint: {
    check: RawSqlBase;
    name?: string;
  };
}

const isCheckConstraintItem = (
  item: NonUniqDataItem,
): item is CheckConstraintItem => {
  const constraint = (item as unknown as RecordUnknown).constraint as
    | CheckConstraintItem['constraint']
    | undefined;

  return !!constraint?.check;
};

const changeInputToColumnChange = (
  item: ChangeInput,
): RakeDbAst.ColumnChange => {
  if (item instanceof Column || 'type' in item) {
    return columnTypeToColumnChange(item);
  }

  if (isColumnPrimaryKeyChangeInput(item)) {
    return {
      primaryKey: true,
      primaryKeyName: item.columnPrimaryKey.name,
    };
  }

  if (isColumnIndexChangeInput(item)) {
    return {
      indexes: [item.columnIndex],
    };
  }

  if (isColumnExcludeChangeInput(item)) {
    return {
      excludes: [item.columnExclude],
    };
  }

  if (isColumnForeignKeyChangeInput(item)) {
    return {
      foreignKeys: [item.columnForeignKey],
    };
  }

  if (isCheckConstraintItem(item)) {
    return {
      checks: [
        {
          sql: item.constraint.check,
          name: item.constraint.name,
        },
      ],
    };
  }

  throw new Error(
    't.change(...) supports t.check(...) only for check constraints in this form',
  );
};

const columnTypeToColumnChange = (
  item: Column | OneWayChange,
  name?: string,
): RakeDbAst.ColumnChange => {
  if (item instanceof Column) {
    let column = item;
    const foreignKeys = column.data.foreignKeys;
    if (foreignKeys?.some((it) => 'fn' in it)) {
      throw new Error('Callback in foreignKey is not allowed in migration');
    }

    if (name && !column.data.name) {
      column = Object.create(column);
      column.data = { ...column.data, name };
    }

    return {
      column: column,
      type: column.toSQL(),
      nullable: column.data.isNullable,
      ...column.data,
      primaryKey: column.data.primaryKey === undefined ? undefined : true,
      foreignKeys: foreignKeys as RakeDbAst.ColumnChange['foreignKeys'],
    };
  }

  return item.to;
};

const nameKey = Symbol('name');

const getName = (self: TableChangeMethods) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (self as any)[nameKey] as string | undefined;
};

const setName = (
  self: TableChangeMethods,
  item: RakeDbAst.ColumnChange | Column,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = (self as any)[nameKey];
  if (!name) return;

  if ('column' in item && item.column instanceof Column) {
    item.column.data.name ??= name;
  } else if (item instanceof Column) {
    item.data.name ??= name;
  } else {
    (item as RecordUnknown).name ??= name;
  }
};

interface TableChangeMethods extends TableMethods, TableDataMethods<string> {
  name(name: string): TableChangeMethods;
  add: Add;
  drop: Add;
  primaryKey<Columns extends [string, ...string[]], Name extends string>(
    columns: Columns,
    name?: Name,
  ): {
    tableDataItem: true;
    columns: Columns;
    name: string extends Name ? never : Name;
  };
  primaryKey(name?: string): ColumnPrimaryKeyChangeInput;
  index(
    columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
    options?: TableData.Index.OptionsArg,
  ): NonUniqDataItem;
  index(options?: TableData.Index.ColumnArg): ColumnIndexChangeInput;
  unique<
    Columns extends [
      string | TableData.Index.ColumnOrExpressionOptions,
      ...(string | TableData.Index.ColumnOrExpressionOptions)[],
    ],
    Name extends string,
  >(
    columns: Columns,
    options?: TableData.Index.UniqueOptionsArg<Name>,
  ): {
    tableDataItem: true;
    columns: Columns extends (
      | string
      | TableData.Index.ColumnOptionsForColumn<string>
    )[]
      ? {
          [I in keyof Columns]: 'column' extends keyof Columns[I]
            ? Columns[I]['column']
            : Columns[I];
        }
      : never;
    name: string extends Name ? never : Name;
  };
  unique(options?: TableData.Index.UniqueColumnArg): ColumnIndexChangeInput;
  exclude(
    columns: TableData.Exclude.ColumnOrExpressionOptions[],
    options?: TableData.Exclude.Options,
  ): NonUniqDataItem;
  exclude(
    with_: string,
    options?: TableData.Exclude.ColumnArg,
  ): ColumnExcludeChangeInput;
  foreignKey<Shape>(
    columns: [string, ...string[]],
    fnOrTable: () => new () => { columns: { shape: Shape } },
    foreignColumns: [keyof Shape, ...(keyof Shape)[]],
    options?: TableData.References.Options,
  ): NonUniqDataItem;
  foreignKey(
    columns: [string, ...string[]],
    fnOrTable: string,
    foreignColumns: [string, ...string[]],
    options?: TableData.References.Options,
  ): NonUniqDataItem;
  foreignKey(
    fnOrTable: string,
    foreignColumn: string,
    options?: TableData.References.Options,
  ): ColumnForeignKeyChangeInput;
  change(from: ChangeInput, to: ChangeInput, using?: ChangeOptions): Change;
  default(value: unknown | RawSqlBase): OneWayChange;
  nullable(): OneWayChange;
  nonNullable(): OneWayChange;
  comment(comment: string | null): OneWayChange;
  rename(name: string): RakeDbAst.ChangeTableItem.Rename;
}

function foreignKey<Shape>(
  columns: [string, ...string[]],
  fnOrTable: () => new () => { columns: { shape: Shape } },
  foreignColumns: [keyof Shape, ...(keyof Shape)[]],
  options?: TableData.References.Options,
): NonUniqDataItem;
function foreignKey(
  columns: [string, ...string[]],
  fnOrTable: string,
  foreignColumns: [string, ...string[]],
  options?: TableData.References.Options,
): NonUniqDataItem;
function foreignKey(
  fnOrTable: string,
  foreignColumn: string,
  options?: TableData.References.Options,
): ColumnForeignKeyChangeInput;
function foreignKey(
  ...args: TableDataForeignKeyArgs | ColumnForeignKeyArgs
): NonUniqDataItem | ColumnForeignKeyChangeInput {
  if (Array.isArray(args[0])) {
    const [columns, fnOrTable, foreignColumns, options] =
      args as TableDataForeignKeyArgs;
    return (
      tableDataMethods.foreignKey as (
        columns: [string, ...string[]],
        fnOrTable: string | (() => new () => { columns: { shape: unknown } }),
        foreignColumns: [PropertyKey, ...PropertyKey[]],
        options?: TableData.References.Options,
      ) => NonUniqDataItem
    )(columns, fnOrTable, foreignColumns, options);
  }

  const [fnOrTable, foreignColumn, options] = args as ColumnForeignKeyArgs;

  return {
    columnForeignKey: {
      fnOrTable,
      foreignColumns: [foreignColumn],
      options,
    },
  };
}

type TableDataPrimaryKeyArgs = [columns: [string, ...string[]], name?: string];
type ColumnPrimaryKeyArgs = [name?: string];

function primaryKey<Columns extends [string, ...string[]], Name extends string>(
  columns: Columns,
  name?: Name,
): {
  tableDataItem: true;
  columns: Columns;
  name: string extends Name ? never : Name;
};
function primaryKey(name?: string): ColumnPrimaryKeyChangeInput;
function primaryKey(...args: TableDataPrimaryKeyArgs | ColumnPrimaryKeyArgs):
  | {
      tableDataItem: true;
      columns: [string, ...string[]];
      name: string;
    }
  | ColumnPrimaryKeyChangeInput {
  if (Array.isArray(args[0])) {
    const [columns, name] = args as TableDataPrimaryKeyArgs;
    return tableDataMethods.primaryKey(columns, name) as {
      tableDataItem: true;
      columns: [string, ...string[]];
      name: string;
    };
  }

  const [name] = args as ColumnPrimaryKeyArgs;
  return {
    columnPrimaryKey: {
      name,
    },
  };
}

type ColumnIndexArgs = [options?: TableData.Index.ColumnArg];
type TableDataIndexArgs =
  | [
      columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
      options?: TableData.Index.OptionsArg,
    ]
  | [
      columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
      name: string,
      options?: TableData.Index.OptionsArg,
    ];

function index(
  columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
  options?: TableData.Index.OptionsArg,
): NonUniqDataItem;
function index(options?: TableData.Index.ColumnArg): ColumnIndexChangeInput;
function index(
  ...args: TableDataIndexArgs | ColumnIndexArgs
): NonUniqDataItem | ColumnIndexChangeInput {
  if (Array.isArray(args[0])) {
    const [columns, first, second] = args as TableDataIndexArgs;
    if (typeof first === 'string') {
      return (
        tableDataMethods.index as (
          columns: (string | TableData.Index.ColumnOrExpressionOptions)[],
          name: string,
          options?: TableData.Index.OptionsArg,
        ) => NonUniqDataItem
      )(columns, first, second);
    }
    return tableDataMethods.index(columns, first) as NonUniqDataItem;
  }

  const [options] = args as ColumnIndexArgs;
  return {
    columnIndex: {
      options: {
        ...options,
      },
    },
  };
}

type ColumnUniqueArgs = [options?: TableData.Index.UniqueColumnArg];
type TableDataUniqueArgs =
  | [
      columns: [
        string | TableData.Index.ColumnOrExpressionOptions,
        ...(string | TableData.Index.ColumnOrExpressionOptions)[],
      ],
      options?: TableData.Index.UniqueOptionsArg,
    ]
  | [
      columns: [
        string | TableData.Index.ColumnOrExpressionOptions,
        ...(string | TableData.Index.ColumnOrExpressionOptions)[],
      ],
      name: string,
      options?: TableData.Index.UniqueOptionsArg,
    ];
function unique<
  Columns extends [
    string | TableData.Index.ColumnOrExpressionOptions,
    ...(string | TableData.Index.ColumnOrExpressionOptions)[],
  ],
  Name extends string,
>(
  columns: Columns,
  options?: TableData.Index.UniqueOptionsArg<Name>,
): {
  tableDataItem: true;
  columns: Columns extends (
    | string
    | TableData.Index.ColumnOptionsForColumn<string>
  )[]
    ? {
        [I in keyof Columns]: 'column' extends keyof Columns[I]
          ? Columns[I]['column']
          : Columns[I];
      }
    : never;
  name: string extends Name ? never : Name;
};
function unique(
  options?: TableData.Index.UniqueColumnArg,
): ColumnIndexChangeInput;
function unique(...args: TableDataUniqueArgs | ColumnUniqueArgs):
  | {
      tableDataItem: true;
      columns: string[];
      name: string;
    }
  | ColumnIndexChangeInput {
  if (Array.isArray(args[0])) {
    const [columns, first, second] = args as TableDataUniqueArgs;
    if (typeof first === 'string') {
      return (
        tableDataMethods.unique as (
          columns: [
            string | TableData.Index.ColumnOrExpressionOptions,
            ...(string | TableData.Index.ColumnOrExpressionOptions)[],
          ],
          name: string,
          options?: TableData.Index.UniqueOptionsArg,
        ) => {
          tableDataItem: true;
          columns: string[];
          name: string;
        }
      )(columns, first, second);
    }
    return tableDataMethods.unique(columns, first) as {
      tableDataItem: true;
      columns: string[];
      name: string;
    };
  }

  const [options] = args as ColumnUniqueArgs;
  return {
    columnIndex: {
      options: {
        ...options,
        unique: true,
      },
    },
  };
}

type TableDataExcludeArgs =
  | [
      columns: TableData.Exclude.ColumnOrExpressionOptions[],
      options?: TableData.Exclude.Options,
    ]
  | [
      columns: TableData.Exclude.ColumnOrExpressionOptions[],
      name: string,
      options?: TableData.Exclude.Options,
    ];
type ColumnExcludeArgs = [with_: string, options?: TableData.Exclude.ColumnArg];

function exclude(
  columns: TableData.Exclude.ColumnOrExpressionOptions[],
  options?: TableData.Exclude.Options,
): NonUniqDataItem;
function exclude(
  with_: string,
  options?: TableData.Exclude.ColumnArg,
): ColumnExcludeChangeInput;
function exclude(
  ...args: TableDataExcludeArgs | ColumnExcludeArgs
): NonUniqDataItem | ColumnExcludeChangeInput {
  if (Array.isArray(args[0])) {
    const [columns, first, second] = args as TableDataExcludeArgs;
    if (typeof first === 'string') {
      return (
        tableDataMethods.exclude as (
          columns: TableData.Exclude.ColumnOrExpressionOptions[],
          name: string,
          options?: TableData.Exclude.Options,
        ) => NonUniqDataItem
      )(columns, first, second);
    }
    return tableDataMethods.exclude(columns, first) as NonUniqDataItem;
  }

  const [with_, options] = args as ColumnExcludeArgs;

  return {
    columnExclude: {
      with: with_,
      options: {
        ...options,
      },
    },
  };
}

const tableChangeMethods: TableChangeMethods = {
  ...tableMethods,
  ...tableDataMethods,
  name(name) {
    setCurrentColumnName(name);
    const types = Object.create(this);
    types[nameKey] = name;
    return types;
  },
  add,
  drop,
  primaryKey,
  index,
  unique,
  exclude,
  foreignKey,
  change(from, to, using) {
    consumeColumnName();
    const f = changeInputToColumnChange(from);
    const t = changeInputToColumnChange(to);
    setName(this, f);
    setName(this, t);

    return {
      type: 'change',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (this as any)[nameKey],
      from: f,
      to: t,
      using,
    };
  },
  default(value) {
    return { type: 'change', to: { default: value } };
  },
  nullable() {
    return {
      type: 'change',
      to: { nullable: true },
    };
  },
  nonNullable() {
    return {
      type: 'change',
      to: { nullable: false },
    };
  },
  comment(comment) {
    return { type: 'change', to: { comment } };
  },
  /**
   * Rename a column:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.changeTable('table', (t) => ({
   *     oldColumnName: t.rename('newColumnName'),
   *   }));
   * });
   * ```
   *
   * Note that the renaming `ALTER TABLE` is executed before the rest of alterations,
   * so if you're also adding a new constraint on this column inside the same `changeTable`,
   * refer to it with a new name.
   *
   * @param name
   */
  rename(name) {
    return { type: 'rename', name };
  },
};

export type TableChanger<CT> = MigrationColumnTypes<CT> & TableChangeMethods;

export type TableChangeData = Record<
  string,
  | RakeDbAst.ChangeTableItem.Column
  | RakeDbAst.ChangeTableItem.Rename
  | Change
  | SpecialChange
  | Column.Pick.Data
>;

export const changeTable = async <CT>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  options: ChangeTableOptions,
  fn?: ChangeTableCallback<CT>,
): Promise<void> => {
  const snakeCase =
    'snakeCase' in options ? options.snakeCase : migration.options.snakeCase;
  const language =
    'language' in options ? options.language : migration.options.language;

  setDefaultLanguage(language);
  resetChangeTableData();

  const tableChanger = Object.create(
    migration.columnTypes as object,
  ) as TableChanger<CT>;
  Object.assign(tableChanger, tableChangeMethods);

  addOrDropChanges.length = 0;
  standaloneCheckChanges.length = 0;
  const changeData = fn?.(tableChanger) || {};

  const schema = migration.adapter.getSchema();

  const ast = makeAst(
    schema,
    up,
    tableName,
    changeData,
    changeTableData,
    options,
  );

  const queries = astToQueries(schema, ast, snakeCase, language);

  for (const query of queries) {
    const result = await migration.adapter.arrays(interpolateSqlValues(query));
    query.then?.(result);
  }
};

const makeAst = (
  schema: QuerySchema | undefined,
  up: boolean,
  name: string,
  changeData: TableChangeData,
  changeTableData: ChangeTableData,
  options: ChangeTableOptions,
): RakeDbAst.ChangeTable => {
  const { comment } = options;

  const shape: RakeDbAst.ChangeTableShape = {};
  const consumedChanges: RecordKeyTrue = {};
  for (const key in changeData) {
    let item = changeData[key] as
      | Change
      | RakeDbAst.ChangeTableItem.Rename
      | RakeDbAst.ChangeTableItem.Column;

    if (item === undefined) continue;

    if (typeof item === 'number') {
      consumedChanges[item] = true;
      item = addOrDropChanges[item];
    } else if (item instanceof Column) {
      item = addOrDrop('add', item);
    }

    if ('type' in item) {
      if (up) {
        shape[key] = item;
      } else {
        if (item.type === 'rename') {
          shape[item.name] = { ...item, name: key };
        } else {
          shape[key] =
            item.type === 'add'
              ? { ...item, type: 'drop' }
              : item.type === 'drop'
                ? { ...item, type: 'add' }
                : item.type === 'change'
                  ? {
                      ...item,
                      from: item.to,
                      to: item.from,
                      using: item.using && {
                        usingUp: item.using.usingDown,
                        usingDown: item.using.usingUp,
                      },
                    }
                  : item;
        }
      }
    }
  }

  for (const checkChange of standaloneCheckChanges) {
    if (consumedChanges[checkChange.index]) continue;
    parseTableDataInput(changeTableData[checkChange.type], checkChange.item);
    consumedChanges[checkChange.index] = true;
  }

  for (let i = 0; i < addOrDropChanges.length; i++) {
    if (consumedChanges[i]) continue;

    const change = addOrDropChanges[i];
    if (change.type === 'change') {
      throw new Error(
        'Standalone helper add/drop changes must be assigned to a column key',
      );
    }
    const name = change.item.data.name;
    if (!name) {
      throw new Error(`Column in ...t.${change.type}() must have a name`);
    }

    const arr = shape[name] ? toArray(shape[name]) : [];
    arr[up ? 'push' : 'unshift'](
      up ? change : { ...change, type: change.type === 'add' ? 'drop' : 'add' },
    );
    shape[name] = arr;
  }

  const [s, table] = getSchemaAndTableFromName(schema, name);

  return {
    type: 'changeTable',
    schema: s,
    name: table,
    comment: comment
      ? up
        ? Array.isArray(comment)
          ? comment[1]
          : comment
        : Array.isArray(comment)
          ? comment[0]
          : null
      : undefined,
    shape,
    ...(up
      ? changeTableData
      : { add: changeTableData.drop, drop: changeTableData.add }),
  };
};

interface PrimaryKey extends TableData.PrimaryKey {
  change?: true;
}

const astToQueries = (
  schema: QuerySchema | undefined,
  ast: RakeDbAst.ChangeTable,
  snakeCase?: boolean,
  language?: string,
): TableQuery[] => {
  const queries: TableQuery[] = [];

  if (ast.comment !== undefined) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${
        ast.comment === null
          ? 'NULL'
          : escapeString(
              typeof ast.comment === 'string' ? ast.comment : ast.comment[1],
            )
      }`,
    });
  }

  const addPrimaryKeys: PrimaryKey = {
    columns: [],
  };

  const dropPrimaryKeys: PrimaryKey = {
    columns: [],
  };

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (Array.isArray(item)) {
      for (const it of item) {
        handlePrerequisitesForTableItem(
          schema,
          key,
          it,
          queries,
          addPrimaryKeys,
          dropPrimaryKeys,
          snakeCase,
        );
      }
    } else {
      handlePrerequisitesForTableItem(
        schema,
        key,
        item,
        queries,
        addPrimaryKeys,
        dropPrimaryKeys,
        snakeCase,
      );
    }
  }

  if (ast.add.primaryKey) {
    addPrimaryKeys.name = ast.add.primaryKey.name;
    const { columns } = ast.add.primaryKey;
    addPrimaryKeys.columns.push(
      ...(snakeCase ? columns.map(toSnakeCase) : columns),
    );
  }

  if (ast.drop.primaryKey) {
    dropPrimaryKeys.name = ast.drop.primaryKey.name;
    const { columns } = ast.drop.primaryKey;
    dropPrimaryKeys.columns.push(
      ...(snakeCase ? columns.map(toSnakeCase) : columns),
    );
  }

  const alterTable: string[] = [];
  const renameItems: string[] = [];
  const values: unknown[] = [];
  const addIndexes = ast.add.indexes ?? [];
  const dropIndexes = ast.drop.indexes ?? [];
  const addExcludes = ast.add.excludes ?? [];
  const dropExcludes = ast.drop.excludes ?? [];
  const addConstraints = ast.add.constraints ?? [];
  const dropConstraints = ast.drop.constraints ?? [];

  const comments: ColumnComment[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (Array.isArray(item)) {
      for (const it of item) {
        handleTableItemChange(
          schema,
          key,
          it,
          ast,
          alterTable,
          renameItems,
          values,
          addPrimaryKeys,
          addIndexes,
          dropIndexes,
          addExcludes,
          dropExcludes,
          addConstraints,
          dropConstraints,
          comments,
          snakeCase,
        );
      }
    } else {
      handleTableItemChange(
        schema,
        key,
        item,
        ast,
        alterTable,
        renameItems,
        values,
        addPrimaryKeys,
        addIndexes,
        dropIndexes,
        addExcludes,
        dropExcludes,
        addConstraints,
        dropConstraints,
        comments,
        snakeCase,
      );
    }
  }

  const prependAlterTable: string[] = [];

  if (
    dropPrimaryKeys.change &&
    addPrimaryKeys.change &&
    dropPrimaryKeys.name === addPrimaryKeys.name &&
    dropPrimaryKeys.columns.length === addPrimaryKeys.columns.length &&
    dropPrimaryKeys.columns.every(
      (column, i) => column === addPrimaryKeys.columns[i],
    )
  ) {
    dropPrimaryKeys.change = addPrimaryKeys.change = undefined;
    dropPrimaryKeys.columns.length = addPrimaryKeys.columns.length = 0;
  }

  if (
    ast.drop.primaryKey ||
    dropPrimaryKeys.change ||
    dropPrimaryKeys.columns.length > 1
  ) {
    const name = dropPrimaryKeys.name || `${ast.name}_pkey`;
    prependAlterTable.push(`DROP CONSTRAINT "${name}"`);
  }

  prependAlterTable.push(
    ...dropConstraints.map(
      (foreignKey) =>
        `\n DROP ${constraintToSql(
          schema,
          ast,
          false,
          foreignKey,
          values,
          snakeCase,
        )}`,
    ),
  );

  alterTable.unshift(...prependAlterTable);

  if (
    ast.add.primaryKey ||
    addPrimaryKeys.change ||
    addPrimaryKeys.columns.length > 1
  ) {
    addPrimaryKeys.columns = [...new Set(addPrimaryKeys.columns)];

    alterTable.push(
      `ADD ${primaryKeyToSql(
        snakeCase
          ? {
              name: addPrimaryKeys.name,
              columns: addPrimaryKeys.columns.map(toSnakeCase),
            }
          : addPrimaryKeys,
      )}`,
    );
  }

  alterTable.push(
    ...addConstraints.map(
      (foreignKey) =>
        `\n ADD ${constraintToSql(
          schema,
          ast,
          true,
          foreignKey,
          values,
          snakeCase,
        )}`,
    ),
  );

  const tableName = quoteWithSchema(ast);
  if (renameItems.length) {
    queries.push(
      ...renameItems.map((sql) => ({
        text: `ALTER TABLE ${tableName}
  ${sql}`,
        values,
      })),
    );
  }

  if (alterTable.length) {
    queries.push(alterTableSql(tableName, alterTable, values));
  }

  queries.push(...indexesToQuery(false, ast, dropIndexes, snakeCase, language));
  queries.push(...indexesToQuery(true, ast, addIndexes, snakeCase, language));
  queries.push(...excludesToQuery(false, ast, dropExcludes, snakeCase));
  queries.push(...excludesToQuery(true, ast, addExcludes, snakeCase));
  queries.push(...commentsToQuery(ast, comments));

  return queries;
};

const alterTableSql = (
  tableName: string,
  lines: string[],
  values: unknown[],
) => ({
  text: `ALTER TABLE ${tableName}
  ${lines.join(',\n  ')}`,
  values,
});

const setPrimaryKeyName = (
  key: string,
  primaryKey: PrimaryKey,
  name?: string,
) => {
  if (!name) return;

  // A single ALTER TABLE statement can only add/drop one primary key name.
  if (primaryKey.name && primaryKey.name !== name) {
    throw new Error(
      `Cannot use different primary key names in standalone changes for column ${key}`,
    );
  }

  primaryKey.name = name;
};

const handlePrerequisitesForTableItem = (
  schema: QuerySchema | undefined,
  key: string,
  item: RakeDbAst.ChangeTableItem,
  queries: TableQuery[],
  addPrimaryKeys: PrimaryKey,
  dropPrimaryKeys: PrimaryKey,
  snakeCase?: boolean,
) => {
  if ('item' in item) {
    const { item: column } = item;
    if (column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(schema, column));
    }
  }

  if (item.type === 'add') {
    if (item.item.data.primaryKey) {
      addPrimaryKeys.columns.push(getColumnName(item.item, key, snakeCase));
    }
  } else if (item.type === 'drop') {
    if (item.item.data.primaryKey) {
      dropPrimaryKeys.columns.push(getColumnName(item.item, key, snakeCase));
    }
  } else if (item.type === 'change') {
    if (item.from.column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(schema, item.from.column));
    }

    if (item.to.column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(schema, item.to.column));
    }

    if (item.from.primaryKey) {
      setPrimaryKeyName(key, dropPrimaryKeys, item.from.primaryKeyName);
      dropPrimaryKeys.columns.push(
        item.from.column
          ? getColumnName(item.from.column, key, snakeCase)
          : snakeCase
            ? toSnakeCase(key)
            : key,
      );
      dropPrimaryKeys.change = true;
    }

    if (item.to.primaryKey) {
      setPrimaryKeyName(key, addPrimaryKeys, item.to.primaryKeyName);
      addPrimaryKeys.columns.push(
        item.to.column
          ? getColumnName(item.to.column, key, snakeCase)
          : snakeCase
            ? toSnakeCase(key)
            : key,
      );
      addPrimaryKeys.change = true;
    }
  }
};

const handleTableItemChange = (
  schema: QuerySchema | undefined,
  key: string,
  item: RakeDbAst.ChangeTableItem,
  ast: RakeDbAst.ChangeTable,
  alterTable: string[],
  renameItems: string[],
  values: unknown[],
  addPrimaryKeys: PrimaryKey,
  addIndexes: TableData.Index[],
  dropIndexes: TableData.Index[],
  addExcludes: TableData.Exclude[],
  dropExcludes: TableData.Exclude[],
  addConstraints: TableData.Constraint[],
  dropConstraints: TableData.Constraint[],
  comments: ColumnComment[],
  snakeCase?: boolean,
) => {
  if (item.type === 'add') {
    const column = item.item;
    const name = getColumnName(column, key, snakeCase);
    addColumnIndex(addIndexes, name, column);
    addColumnExclude(addExcludes, name, column);
    addColumnComment(comments, name, column);

    alterTable.push(
      `ADD COLUMN ${columnToSql(
        schema,
        name,
        column,
        values,
        addPrimaryKeys.columns.length > 1,
        snakeCase,
      )}`,
    );
  } else if (item.type === 'drop') {
    const name = getColumnName(item.item, key, snakeCase);

    alterTable.push(
      `DROP COLUMN "${name}"${item.dropMode ? ` ${item.dropMode}` : ''}`,
    );
  } else if (item.type === 'change') {
    const { from, to } = item;
    const name = getChangeColumnName('to', item, key, snakeCase);
    const fromName = getChangeColumnName('from', item, key, snakeCase);

    if (fromName !== name) {
      renameItems.push(renameColumnSql(fromName, name));
    }

    let changeType = false;
    if (to.type && (from.type !== to.type || from.collate !== to.collate)) {
      changeType = true;

      const type =
        !to.column || to.column.data.isOfCustomType
          ? to.column && to.column instanceof DomainColumn
            ? quoteNameFromString(schema, to.type)
            : quoteCustomType(schema, to.type)
          : to.type;

      const using = item.using?.usingUp
        ? ` USING ${item.using.usingUp.toSQL({ values })}`
        : to.column instanceof EnumColumn
          ? ` USING "${name}"::text::${type}`
          : to.column instanceof ArrayColumn
            ? ` USING "${name}"::text[]::${type}`
            : '';

      alterTable.push(
        `ALTER COLUMN "${name}" TYPE ${type}${
          to.collate
            ? ` COLLATE ${quoteNameFromString(schema, to.collate)}`
            : ''
        }${using}`,
      );
    }

    if (
      typeof from.identity !== typeof to.identity ||
      !deepCompare(from.identity, to.identity)
    ) {
      if (from.identity) {
        alterTable.push(`ALTER COLUMN "${name}" DROP IDENTITY`);
      }

      if (to.identity) {
        alterTable.push(
          `ALTER COLUMN "${name}" ADD ${identityToSql(schema, to.identity)}`,
        );
      }
    }

    if (from.default !== to.default) {
      const value = encodeColumnDefault(to.default, values, to.column);

      // when changing type, need to first drop an existing default before setting a new one
      if (changeType && value !== null) {
        alterTable.push(`ALTER COLUMN "${name}" DROP DEFAULT`);
      }

      const expr = value === null ? 'DROP DEFAULT' : `SET DEFAULT ${value}`;

      alterTable.push(`ALTER COLUMN "${name}" ${expr}`);
    }

    if (from.nullable !== to.nullable) {
      alterTable.push(
        `ALTER COLUMN "${name}" ${to.nullable ? 'DROP' : 'SET'} NOT NULL`,
      );
    }

    if (from.compression !== to.compression) {
      alterTable.push(
        `ALTER COLUMN "${name}" SET COMPRESSION ${to.compression || 'DEFAULT'}`,
      );
    }

    const fromChecks =
      from.checks && nameColumnChecks(ast.name, fromName, from.checks);
    const toChecks = to.checks && nameColumnChecks(ast.name, name, to.checks);

    fromChecks?.forEach((fromCheck) => {
      if (!toChecks?.some((toCheck) => cmpRawSql(fromCheck.sql, toCheck.sql))) {
        alterTable.push(`DROP CONSTRAINT "${fromCheck.name}"`);
      }
    });

    toChecks?.forEach((toCheck) => {
      if (
        !fromChecks?.some((fromCheck) => cmpRawSql(fromCheck.sql, toCheck.sql))
      ) {
        alterTable.push(
          `ADD CONSTRAINT "${toCheck.name}"\n    CHECK (${toCheck.sql.toSQL({
            values,
          })})`,
        );
      }
    });

    const foreignKeysLen = Math.max(
      from.foreignKeys?.length || 0,
      to.foreignKeys?.length || 0,
    );
    for (let i = 0; i < foreignKeysLen; i++) {
      const fromFkey = from.foreignKeys?.[i];
      const toFkey = to.foreignKeys?.[i];

      if (
        (fromFkey || toFkey) &&
        (!fromFkey ||
          !toFkey ||
          fromFkey.options?.name !== toFkey.options?.name ||
          fromFkey.options?.match !== toFkey.options?.match ||
          fromFkey.options?.onUpdate !== toFkey.options?.onUpdate ||
          fromFkey.options?.onDelete !== toFkey.options?.onDelete ||
          fromFkey.options?.dropMode !== toFkey.options?.dropMode ||
          (fromFkey.fnOrTable as string) !== (toFkey.fnOrTable as string))
      ) {
        if (fromFkey) {
          dropConstraints.push({
            name: fromFkey.options?.name,
            dropMode: fromFkey.options?.dropMode,
            references: {
              columns: [name],
              ...fromFkey,
              foreignColumns: snakeCase
                ? fromFkey.foreignColumns.map(toSnakeCase)
                : fromFkey.foreignColumns,
            },
          });
        }

        if (toFkey) {
          addConstraints.push({
            name: toFkey.options?.name,
            dropMode: toFkey.options?.dropMode,
            references: {
              columns: [name],
              ...toFkey,
              foreignColumns: snakeCase
                ? toFkey.foreignColumns.map(toSnakeCase)
                : toFkey.foreignColumns,
            },
          });
        }
      }
    }

    pushIndexesOrExcludes('indexes', from, to, name, addIndexes, dropIndexes);
    pushIndexesOrExcludes(
      'excludes',
      from,
      to,
      name,
      addExcludes,
      dropExcludes,
    );

    if (from.comment !== to.comment) {
      comments.push({ column: name, comment: to.comment || null });
    }
  } else if (item.type === 'rename') {
    renameItems.push(
      snakeCase
        ? renameColumnSql(toSnakeCase(key), toSnakeCase(item.name))
        : renameColumnSql(key, item.name),
    );
  }
};

const pushIndexesOrExcludes = <T extends TableData.Index | TableData.Exclude>(
  key: 'indexes' | 'excludes',
  from: RakeDbAst.ColumnChange,
  to: RakeDbAst.ColumnChange,
  name: string,
  add: T[],
  drop: T[],
) => {
  const len = Math.max(from[key]?.length || 0, to[key]?.length || 0);
  for (let i = 0; i < len; i++) {
    const fromItem = from[key]?.[i];
    const toItem = to[key]?.[i];

    if (
      (fromItem || toItem) &&
      (!fromItem || !toItem || !deepCompare(fromItem, toItem))
    ) {
      if (fromItem) {
        drop.push({
          ...fromItem,
          columns: [
            {
              column: name,
              ...fromItem.options,
              with: (fromItem as TableData.ColumnExclude).with,
            },
          ],
        } as T);
      }

      if (toItem) {
        add.push({
          ...toItem,
          columns: [
            {
              column: name,
              ...toItem.options,
              with: (toItem as TableData.ColumnExclude).with,
            },
          ],
        } as T);
      }
    }
  }
};

const getChangeColumnName = (
  what: 'from' | 'to',
  change: RakeDbAst.ChangeTableItem.Change,
  key: string,
  snakeCase?: boolean,
) => {
  return (
    change.name ||
    (change[what].column
      ? //
        getColumnName(change[what].column!, key, snakeCase)
      : snakeCase
        ? toSnakeCase(key)
        : key)
  );
};

const renameColumnSql = (from: string, to: string) => {
  return `RENAME COLUMN "${from}" TO "${to}"`;
};
