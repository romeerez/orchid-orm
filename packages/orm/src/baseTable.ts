import {
  AfterHook,
  ComputedColumnsBase,
  Db,
  DbTableOptionScopes,
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  getColumnTypes,
  makeColumnTypes,
  MapTableScopesOption,
  parseTableData,
  Query,
  QueryAfterHook,
  QueryBase,
  QueryBeforeHook,
  QueryData,
  QueryHooks,
  RelationQueryBase,
  ShapeColumnPrimaryKeys,
  ShapeUniqueColumns,
  TableData,
  TableDataFn,
  TableDataItem,
  TableDataItemsUniqueColumns,
  TableDataItemsUniqueColumnTuples,
  TableDataItemsUniqueConstraints,
  UniqueConstraints,
} from 'pqb';
import {
  applyMixins,
  ColumnSchemaConfig,
  ColumnShapeInput,
  ColumnShapeInputPartial,
  ColumnShapeOutput,
  ColumnsShapeBase,
  CoreQueryScopes,
  emptyArray,
  emptyObject,
  EmptyObject,
  getCallerFilePath,
  getStackTrace,
  MaybeArray,
  RecordUnknown,
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
export interface TableClass<T extends Table = Table> {
  new (): T;
  instance(): T;
}

// object with table classes, used on orchidORM() for setting tables
export interface TableClasses {
  [K: string]: TableClass;
}

interface RelationQueriesBase {
  [K: string]: RelationQueryBase;
}

// convert table instance type to queryable interface
// processes relations to a type that's understandable by `pqb`
// add ORM table specific metadata like `definedAt`, `db`, `getFilePath`
export interface TableToDb<
  T extends Table,
  RelationQueries extends RelationQueriesBase,
> extends Db<
    T['table'],
    T['columns']['shape'],
    keyof ShapeColumnPrimaryKeys<T['columns']['shape']> extends never
      ? never
      : ShapeColumnPrimaryKeys<T['columns']['shape']>,
    | ShapeUniqueColumns<T['columns']['shape']>
    | TableDataItemsUniqueColumns<T['columns']['shape'], T['columns']['data']>,
    TableDataItemsUniqueColumnTuples<
      T['columns']['shape'],
      T['columns']['data']
    >,
    | UniqueConstraints<T['columns']['shape']>
    | TableDataItemsUniqueConstraints<T['columns']['data']>,
    RelationQueries,
    T['types'],
    T['computed'] extends RecordUnknown
      ? T['columns']['shape'] & {
          [K in keyof T['computed']]: ReturnType<T['computed'][K]>['_type'];
        }
      : T['columns']['shape'],
    MapTableScopesOption<T['scopes'], T['softDelete']>
  > {
  definedAs: string;
  db: OrchidORM;
  getFilePath(): string;
  name: string;
}

// convert a table class type into queryable interface
// add relation methods
export type DbTable<T extends Table> = TableToDb<T, MapRelations<T>> &
  MapRelations<T>;

// `columns` property of table has a shape and an output type of the columns
// callback with a query of relation, to use as a default scope
export type ScopeFn<Related extends TableClass, Scope extends Query> = (
  q: DbTable<InstanceType<Related>>,
) => Scope;

// type of table instance created by a table class
export interface Table {
  // table name
  table: string;
  // columns shape and the record type
  columns: { shape: ColumnsShapeBase; data: MaybeArray<TableDataItem> };
  // database schema containing this table
  schema?: string;
  // column types defined in base table to use in `setColumns`
  types: unknown;
  // suppress no primary key warning
  noPrimaryKey?: boolean;
  // path to file where the table is defined
  filePath: string;
  // default language for the full text search
  language?: string;
  /**
   * collect computed columns returned by {@link BaseTable.setColumns}
   */
  computed?: ComputedColumnsBase<never>;
  // Available scopes for this table defined by user.
  scopes?: CoreQueryScopes;
  // enable soft delete, true for `deletedAt` column, string for column name
  readonly softDelete?: true | string;
  // database table comment
  comment?: string;
}

// Object type that's allowed in `where` and similar methods of the table.
export type Queryable<T extends Table> = {
  [K in keyof T['columns']['shape']]?: T['columns']['shape'][K]['queryType'];
};

// Object type of table's record that's returned from database and is parsed.
export type Selectable<T extends Table> = ColumnShapeOutput<
  T['columns']['shape']
>;

// Object type that conforms `create` method of the table.
export type Insertable<T extends Table> = ColumnShapeInput<
  T['columns']['shape']
>;

// Object type that conforms `update` method of the table.
export type Updatable<T extends Table> = ColumnShapeInputPartial<
  T['columns']['shape']
>;

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

export interface SetColumnsResult<
  Shape extends ColumnsShapeBase,
  Data extends MaybeArray<MaybeArray<TableDataItem>>,
> {
  shape: Shape;
  data: Data extends unknown[] ? Data : [Data];
}

export interface BaseTableInstance<ColumnTypes> {
  table: string;
  columns: { shape: ColumnsShapeBase; data: MaybeArray<TableDataItem> };
  schema?: string;
  noPrimaryKey?: boolean;
  snakeCase?: boolean;
  types: ColumnTypes;
  q: QueryData;
  language?: string;
  filePath: string;
  result: ColumnsShapeBase;
  clone<T extends QueryBase>(this: T): T;
  getFilePath(): string;
  setColumns<
    Shape extends ColumnsShapeBase,
    Data extends MaybeArray<TableDataItem>,
  >(
    fn: (t: ColumnTypes) => Shape,
    tableData?: TableDataFn<Shape, Data>,
  ): SetColumnsResult<Shape, Data>;

  /**
   * You can add a generated column in the migration (see [generated](/guide/migration-column-methods.html#generated-column)),
   * such column will persist in the database, it can be indexed.
   *
   * Or you can add a computed column on the ORM level, without adding it to the database, in such a way:
   *
   * ```ts
   * import { BaseTable } from './baseTable';
   *
   * export class UserTable extends BaseTable {
   *   readonly table = 'user';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     firstName: t.string(),
   *     lastName: t.string(),
   *   }));
   *
   *   computed = this.setComputed({
   *     fullName: (q) =>
   *       q.sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
   *         (t) => t.string(),
   *       ),
   *   });
   * }
   * ```
   *
   * `setComputed` takes an object where keys are computed column names, and values are functions returning raw SQL.
   *
   * Use `q.column` as shown above to reference a table column, it will be prefixed with a correct table name even if the table is joined under a different name.
   *
   * Computed columns are not selected by default, only on demand:
   *
   * ```ts
   * const a = await db.user.take();
   * a.fullName; // not selected
   *
   * const b = await db.user.select('*', 'fullName');
   * b.fullName; // selected
   *
   * // Table post belongs to user as an author.
   * // it's possible to select joined computed column:
   * const posts = await db.post
   *   .join('author')
   *   .select('post.title', 'author.fullName');
   * ```
   *
   * SQL query can be generated dynamically based on the current request context.
   *
   * Imagine we are using [AsyncLocalStorage](https://nodejs.org/api/async_context.html#asynchronous-context-tracking)
   * to keep track of current user's language.
   *
   * And we have articles translated to different languages, each article has `title_en`, `title_uk`, `title_be` and so on.
   *
   * We can define a computed `title` by passing a function into `sql` method:
   *
   * ```ts
   * type Locale = 'en' | 'uk' | 'be';
   * const asyncLanguageStorage = new AsyncLocalStorage<Locale>();
   * const defaultLocale: Locale = 'en';
   *
   * export class ArticleTable extends BaseTable {
   *   readonly table = 'article';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     title_en: t.text(),
   *     title_uk: t.text().nullable(),
   *     title_be: t.text().nullable(),
   *   }));
   *
   *   computed = this.setComputed({
   *     title: (q) =>
   *       q
   *         // .sql can take a function that accepts `sql` argument and must return SQL
   *         .sql((sql) => {
   *           // get locale dynamically based on current storage value
   *           const locale = asyncLanguageStorage.getStore() || defaultLocale;
   *
   *           // use COALESCE in case when localized title is NULL, use title_en
   *           return sql`COALESCE(
   *             ${q.column(`title_${locale}`)},
   *             ${q.column(`title_${defaultLocale}`)}
   *           )`;
   *         })
   *         .type((t) => t.text()),
   *   });
   * }
   * ```
   *
   * @param computed - object where keys are column names and values are functions returning raw SQL
   */
  setComputed<
    Table extends string,
    Shape extends ColumnsShapeBase,
    Computed extends ComputedColumnsBase<
      Db<Table, Shape, never, never, never, never, EmptyObject, ColumnTypes>
    >,
  >(
    computed: Computed,
  ): Computed;

  /**
   * See {@link ScopeMethods}
   */
  setScopes<
    Table extends string,
    Columns extends ColumnsShapeBase,
    Keys extends string,
  >(
    this: { table: Table; columns: { shape: Columns } },
    scopes: DbTableOptionScopes<Table, Columns, Keys>,
  ): CoreQueryScopes<Keys>;

  belongsTo<
    Columns extends ColumnsShapeBase,
    Related extends TableClass,
    Scope extends Query,
    Options extends BelongsToOptions<Columns, Related, Scope>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => Related,
    options: Options,
  ): {
    type: 'belongsTo';
    fn: () => Related;
    options: Options;
  };

  hasOne<
    Columns extends ColumnsShapeBase,
    Related extends TableClass,
    Scope extends Query,
    Through extends string,
    Source extends string,
    Options extends HasOneOptions<Columns, Related, Scope, Through, Source>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => Related,
    options: Options,
  ): {
    type: 'hasOne';
    fn: () => Related;
    options: Options;
  };

  hasMany<
    Columns extends ColumnsShapeBase,
    Related extends TableClass,
    Scope extends Query,
    Through extends string,
    Source extends string,
    Options extends HasManyOptions<Columns, Related, Scope, Through, Source>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => Related,
    options: Options,
  ): {
    type: 'hasMany';
    fn: () => Related;
    options: Options;
  };

  hasAndBelongsToMany<
    Columns extends ColumnsShapeBase,
    Related extends TableClass,
    Scope extends Query,
    Options extends HasAndBelongsToManyOptions<Columns, Related, Scope>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => Related,
    options: Options,
  ): {
    type: 'hasAndBelongsToMany';
    fn: () => Related;
    options: Options;
  };

  beforeQuery: BeforeHookMethod;
  afterQuery: AfterHookMethod;
  beforeCreate: BeforeHookMethod;
  afterCreate: AfterSelectableHookMethod;
  afterCreateCommit: AfterSelectableHookMethod;
  beforeUpdate: BeforeHookMethod;
  afterUpdate: AfterSelectableHookMethod;
  afterUpdateCommit: AfterSelectableHookMethod;
  beforeSave: BeforeHookMethod;
  afterSave: AfterSelectableHookMethod;
  afterSaveCommit: AfterSelectableHookMethod;
  beforeDelete: BeforeHookMethod;
  afterDelete: AfterSelectableHookMethod;
  afterDeleteCommit: AfterSelectableHookMethod;
}

export interface BaseTableClass<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
> {
  nowSQL: string | undefined;
  exportAs: string;
  columnTypes: ColumnTypes;
  getFilePath(): string;

  new (): BaseTableInstance<ColumnTypes>;
  instance(): BaseTableInstance<ColumnTypes>;

  inputSchema: SchemaConfig['inputSchema'];
  outputSchema: SchemaConfig['outputSchema'];
  querySchema: SchemaConfig['querySchema'];
}

// base table constructor
export function createBaseTable<
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  schemaConfig = defaultSchemaConfig as unknown as SchemaConfig,
  columnTypes: columnTypesArg,
  snakeCase,
  filePath: filePathArg,
  nowSQL,
  exportAs = 'BaseTable',
  language,
}: {
  schemaConfig?: SchemaConfig;
  // concrete column types or a callback for overriding standard column types
  // this types will be used in tables to define their columns
  columnTypes?:
    | ColumnTypes
    | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
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
} = {}): BaseTableClass<SchemaConfig, ColumnTypes> {
  const columnTypes = (
    typeof columnTypesArg === 'function'
      ? (
          columnTypesArg as (t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes
        )(makeColumnTypes(schemaConfig))
      : columnTypesArg || makeColumnTypes(schemaConfig)
  ) as ColumnTypes;

  // stack is needed only if filePath wasn't given
  const filePathOrStack = filePathArg || getStackTrace();

  let filePath: string | undefined;

  const defaultColumns: {
    shape: ColumnsShapeBase;
    data: MaybeArray<TableDataItem>;
  } = {
    shape: emptyObject,
    data: emptyArray,
  };

  const base = class BaseTable {
    static nowSQL = nowSQL;
    static exportAs = exportAs;
    static columnTypes = columnTypes;

    private static _inputSchema: unknown;
    static inputSchema() {
      this.instance();
      // Nullish coalescing assignment (??=), for some reason, compiles to != null and miss undefined
      return this._inputSchema === undefined
        ? (this._inputSchema = schemaConfig.inputSchema.call(this))
        : this._inputSchema;
    }

    private static _outputSchema: unknown;
    static outputSchema() {
      this.instance();
      return this._outputSchema === undefined
        ? (this._outputSchema = schemaConfig.outputSchema.call(this))
        : this._outputSchema;
    }

    private static _querySchema: unknown;
    static querySchema() {
      this.instance();
      return this._querySchema === undefined
        ? (this._querySchema = schemaConfig.querySchema.call(this))
        : this._querySchema;
    }

    private static _updateSchema: unknown;
    static updateSchema() {
      this.instance();
      return this._updateSchema === undefined
        ? (this._updateSchema = schemaConfig.updateSchema.call(this))
        : this._updateSchema;
    }

    private static _pkeySchema: unknown;
    static pkeySchema() {
      this.instance();
      return this._pkeySchema === undefined
        ? (this._pkeySchema = schemaConfig.pkeySchema.call(this))
        : this._pkeySchema;
    }

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

    private static _instance?: BaseTable;
    static instance(): BaseTable {
      return (this._instance ??= new this());
    }

    table!: string;
    columns = defaultColumns;
    tableData!: TableData;
    schema?: string;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    types = columnTypes;
    q: QueryData = {} as QueryData;
    language = language;
    declare filePath: string;
    declare result: ColumnsShapeBase;

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

    setColumns<
      Shape extends ColumnsShapeBase,
      Data extends MaybeArray<TableDataItem>,
    >(
      fn: (t: ColumnTypes) => Shape,
      dataFn?: TableDataFn<Shape, Data>,
    ): SetColumnsResult<Shape, Data> {
      (columnTypes as { [snakeCaseKey]?: boolean })[snakeCaseKey] =
        this.snakeCase;

      const shape = getColumnTypes(columnTypes, fn, nowSQL, this.language);
      const tableData = (this.constructor.prototype.tableData =
        parseTableData(dataFn));

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

      // save columns to prototype to make them available in static methods (inputSchema, outputSchema)
      return (this.constructor.prototype.columns = {
        shape,
        data: tableData as never,
      });
    }

    setComputed<
      Table extends string,
      Shape extends ColumnsShapeBase,
      Data extends MaybeArray<TableDataItem>,
      Computed extends ComputedColumnsBase<
        Db<Table, Shape, Data, EmptyObject, ColumnTypes>
      >,
    >(computed: Computed): Computed {
      return computed;
    }

    setScopes(scopes: unknown) {
      return scopes;
    }

    belongsTo(fn: () => unknown, options: unknown) {
      return {
        type: 'belongsTo' as const,
        fn,
        options,
      };
    }

    hasOne(fn: () => unknown, options: unknown) {
      return {
        type: 'hasOne' as const,
        fn,
        options,
      };
    }

    hasMany(fn: () => unknown, options: unknown) {
      return {
        type: 'hasMany' as const,
        fn,
        options,
      };
    }

    hasAndBelongsToMany(fn: () => unknown, options: unknown) {
      return {
        type: 'hasAndBelongsToMany' as const,
        fn,
        options,
      };
    }
  };

  applyMixins(base, [QueryHooks]);

  base.prototype.types = columnTypes as typeof base.prototype.types;

  return base as unknown as BaseTableClass<SchemaConfig, ColumnTypes>;
}
