import {
  AfterHook,
  ColumnsShape,
  columnTypes as defaultColumnTypes,
  Db,
  DefaultColumnTypes,
  getColumnTypes,
  Query,
  QueryAfterHook,
  QueryBase,
  QueryBeforeHook,
  QueryData,
  QueryHooks,
  QueryWithTable,
  RelationQueryBase,
} from 'pqb';
import {
  applyMixins,
  ColumnShapeOutput,
  ColumnsShapeBase,
  ColumnTypesBase,
  getCallerFilePath,
  getStackTrace,
  snakeCaseKey,
  toSnakeCase,
} from 'orchid-core';
import { MapRelations } from './relations/relations';
import { OrchidORM } from './orm';
import { BelongsToOptions } from './relations/belongsTo';
import { HasOneOptions } from './relations/hasOne';
import { HasManyOptions } from './relations/hasMany';
import { HasAndBelongsToManyOptions } from './relations/hasAndBelongsToMany';

// type of table class itself
export type TableClass<T extends Table = Table> = new () => T;

// object with table classes, used on orchidORM() for setting tables
export type TableClasses = Record<string, TableClass>;

// convert table instance type to queryable interface
// processes relations to a type that's understandable by `pqb`
// add ORM table specific metadata like `definedAt`, `db`, `getFilePath`
export type TableToDb<
  T extends Table,
  RelationQueries extends Record<string, RelationQueryBase>,
> = Db<T['table'], T['columns']['shape'], RelationQueries, T['columnTypes']> & {
  definedAs: string;
  db: OrchidORM;
  getFilePath(): string;
  name: string;
};

// convert a table class type into queryable interface
// add relation methods
export type DbTable<
  TC extends TableClass,
  T extends Table = InstanceType<TC>,
  RelationQueries extends Record<string, RelationQueryBase> = MapRelations<T>,
  Q extends QueryWithTable = TableToDb<T, RelationQueries>,
  Result extends QueryWithTable = Q & RelationQueries,
> = Result;

// `columns` property of table has a shape and an output type of the columns
type ColumnsConfig = {
  shape: ColumnsShape;
  type: unknown;
};

// callback with a query of relation, to use as a default scope
export type ScopeFn<Related extends TableClass, Scope extends Query> = (
  q: DbTable<Related>,
) => Scope;

// type of table instance created by a table class
export type Table = {
  // table name
  table: string;
  // columns shape and the record type
  columns: ColumnsConfig;
  // database schema containing this table
  schema?: string;
  // column types defined in base table to use in `setColumns`
  columnTypes: ColumnTypesBase;
  // suppress no primary key warning
  noPrimaryKey?: boolean;
  // path to file where the table is defined
  filePath: string;
  // default language for the full text search
  language?: string;
};

// get the type of table columns
export type TableType<T extends Pick<Table, 'columns'>> = T['columns']['type'];

// type of before hook function for the table
type BeforeHookMethod = <T extends Table>(cb: QueryBeforeHook) => T;

// type of after hook function for the table
type AfterHookMethod = <T extends Table>(cb: QueryAfterHook) => T;

// type of after hook function that allows selecting columns for the table
type AfterSelectableHookMethod = <
  T extends Table,
  S extends (keyof T['columns']['shape'])[],
>(
  this: T,
  select: S,
  cb: AfterHook<S, T['columns']['shape']>,
) => T;

// Couldn't manage it to work otherwise than specifying any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaProviderBase = any;

// base table constructor
export const createBaseTable = <
  ColumnTypes extends ColumnTypesBase,
  SchemaProvider extends SchemaProviderBase,
>({
  columnTypes: columnTypesArg,
  snakeCase,
  filePath: filePathArg,
  nowSQL,
  exportAs = 'BaseTable',
  language,
  schemaProvider: schemaProviderArg,
}: {
  // concrete column types or a callback for overriding standard column types
  // this types will be used in tables to define their columns
  columnTypes?: ColumnTypes | ((t: DefaultColumnTypes) => ColumnTypes);
  // when set to true, all columns will be translated to `snake_case` when querying database
  snakeCase?: boolean;
  // if for some unknown reason you see error that file path for a table can't be guessed automatically,
  // provide it manually via `filePath`
  filePath?: string;
  // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
  nowSQL?: string;
  // export name of the base table, by default it is BaseTable
  exportAs?: string;
  // default language for the full text search
  language?: string;
  // a function to prepare a validation schema based on table's columns,
  // it will be available as `TableClass.schema()` method.
  schemaProvider?: SchemaProvider;
} = {}) => {
  type CT = ColumnTypesBase extends ColumnTypes
    ? DefaultColumnTypes
    : ColumnTypes;

  const columnTypes = (
    typeof columnTypesArg === 'function'
      ? columnTypesArg(defaultColumnTypes)
      : columnTypesArg || defaultColumnTypes
  ) as CT;

  // stack is needed only if filePath wasn't given
  const filePathOrStack = filePathArg || getStackTrace();

  let filePath: string | undefined;

  function schemaProvider(this: Table) {
    const schema = (schemaProviderArg as () => unknown).call(this);
    (this as unknown as { schema: () => unknown }).schema = () => schema;
    return schema;
  }

  const base = class BaseTable {
    static nowSQL = nowSQL;
    static exportAs = exportAs;
    static getFilePath(): string {
      if (filePath) return filePath;
      if (typeof filePathOrStack === 'string') {
        return (filePath = filePathOrStack);
      }

      filePath = getCallerFilePath(filePathOrStack);
      if (filePath) return filePath;

      throw new Error(
        `Failed to determine file path of a base table. Please set the \`filePath\` option of \`createBaseTable\` manually.`,
      );
    }

    table!: string;
    columns!: ColumnsConfig;
    schema?: string;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    columnTypes = columnTypes;
    q: QueryData = {} as QueryData;
    language = language;
    declare filePath: string;
    declare result: ColumnsShapeBase;

    static schema = schemaProvider as SchemaProvider;

    clone<T extends QueryBase>(this: T): T {
      return this;
    }

    getFilePath() {
      if (this.filePath) return this.filePath;
      if (typeof filePathOrStack === 'string')
        return (this.filePath = filePathOrStack);

      const filePath = getCallerFilePath(filePathOrStack);
      if (filePath) return (this.filePath = filePath);

      throw new Error(
        `Failed to determine file path for table ${this.constructor.name}. Please set \`filePath\` property manually`,
      );
    }

    setColumns<T extends ColumnsShape>(
      fn: (t: CT) => T,
    ): { shape: T; type: ColumnShapeOutput<T> } {
      (columnTypes as { [snakeCaseKey]?: boolean })[snakeCaseKey] =
        this.snakeCase;

      const shape = getColumnTypes(columnTypes, fn, nowSQL, this.language);

      if (this.snakeCase) {
        for (const key in shape) {
          const column = shape[key];
          if (column.data.name) continue;

          const snakeName = toSnakeCase(key);
          if (snakeName !== key) {
            column.data.name = snakeName;
          }
        }
      }

      // Memoize columns in the prototype of class.
      // It is accessed in schema-to-tod.
      return (this.constructor.prototype.columns = {
        shape,
        type: undefined as unknown as ColumnShapeOutput<T>,
      });
    }

    belongsTo<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Options extends BelongsToOptions<Self, Related, Scope>,
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'belongsTo' as const,
        fn,
        options,
      };
    }

    hasOne<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends HasOneOptions<Self, Related, Scope, Through, Source>,
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasOne' as const,
        fn,
        options,
      };
    }

    hasMany<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends HasManyOptions<Self, Related, Scope, Through, Source>,
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasMany' as const,
        fn,
        options,
      };
    }

    hasAndBelongsToMany<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Options extends HasAndBelongsToManyOptions<Self, Related, Scope>,
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasAndBelongsToMany' as const,
        fn,
        options,
      };
    }

    declare beforeQuery: BeforeHookMethod;
    declare afterQuery: AfterHookMethod;
    declare beforeCreate: BeforeHookMethod;
    declare afterCreate: AfterSelectableHookMethod;
    declare afterCreateCommit: AfterSelectableHookMethod;
    declare beforeUpdate: BeforeHookMethod;
    declare afterUpdate: AfterSelectableHookMethod;
    declare afterUpdateCommit: AfterSelectableHookMethod;
    declare beforeSave: BeforeHookMethod;
    declare afterSave: AfterSelectableHookMethod;
    declare afterSaveCommit: AfterSelectableHookMethod;
    declare beforeDelete: BeforeHookMethod;
    declare afterDelete: AfterSelectableHookMethod;
    declare afterDeleteCommit: AfterSelectableHookMethod;
  };

  applyMixins(base, [QueryHooks]);

  base.prototype.columnTypes = columnTypes as typeof base.prototype.columnTypes;

  return base;
};
