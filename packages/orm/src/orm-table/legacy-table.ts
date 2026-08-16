import {
  Column,
  AfterHook,
  ComputedOptionsConfig,
  ComputedOptionsFactory,
  _createDbSqlMethod,
  DbSqlMethod,
  DbTableOptionScopes,
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  getColumnTypes,
  makeColumnTypes,
  parseTableData,
  QueryAfterHook,
  QueryBeforeActionHook,
  QueryBeforeHook,
  QueryData,
  QueryHooks,
  QueryScopes,
  TableData,
  TableDataFn,
  TableDataItem,
  applyMixins,
  ColumnSchemaConfig,
  emptyArray,
  EmptyObject,
  emptyObject,
  getCallerFilePath,
  getStackTrace,
  IsQuery,
  MaybeArray,
  RecordUnknown,
  toSnakeCase,
  ColumnsShape,
  QuerySchema,
  Rls,
  Grant,
  type RawSqlBase,
  type BrandColumnsShape,
} from 'pqb/internal';
import {
  RelationConfigSelf,
  RelationToTableInput,
  RelationTableToQuery,
} from '../relations/relations';
import { OrchidORM, OrmTableThunks } from '../orm';
import {
  BelongsTo,
  BelongsToDataForCreate,
  BelongsToDefaultRequired,
  BelongsToInfo,
  BelongsToOptions,
  BelongsToQuery,
} from '../relations/belongs-to/belongs-to';
import {
  HasOne,
  HasOneInfo,
  HasOneOptions,
  HasOneQuery,
} from '../relations/has-one/has-one';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
  HasAndBelongsToManyOptions,
  HasAndBelongsToManyQuery,
} from '../relations/has-and-belongs-to-many/has-and-belongs-to-many';
import {
  HasMany,
  HasManyInfo,
  HasManyQuery,
} from '../relations/has-many/has-many';
import { Db, Query } from 'pqb';
import type { CommonTableFactoryOptions } from './table.common';
export type { CommonTableFactoryOptions } from './table.common';

// type of table class itself
export interface TableClass<T extends ORMTableInput = ORMTableInput> {
  new (): T;
}

export interface TableInfo {
  definedAs: string;
  db: OrchidORM;
  getFilePath(): string;
  name: string;
}

export interface Table extends Query, TableInfo {}

type BelongsToRequired<
  T extends RelationConfigSelf,
  Rel extends BelongsTo,
  Related,
> = Rel['options'] extends {
  required: infer Required extends boolean;
}
  ? Required
  : Rel['options'] extends { on: unknown }
    ? false
    : BelongsToDefaultRequired<T, Rel, Related>;

type BelongsToRelationInfo<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends BelongsTo,
> =
  RelationToTableInput<TC, VC, Rel> extends infer Related extends ORMTableInput
    ? BelongsToInfo<
        T,
        Rel['options']['columns'][number] & string,
        BelongsToRequired<T, Rel, Related>,
        BelongsToQuery<TableQueryBuilder<TC, VC, Related>, Name>
      >
    : never;

type BelongsToCreateData<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends string,
  Rel extends BelongsTo,
> =
  RelationToTableInput<TC, VC, Rel> extends infer Related extends ORMTableInput
    ? BelongsToDataForCreate<
        Name,
        Rel['options']['columns'][number] & string,
        BelongsToRequired<T, Rel, Related>,
        BelongsToQuery<TableQueryBuilder<TC, VC, Related>, Name>
      >
    : never;

type RelationDataForCreate<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
  Rel,
> = Rel extends HasOne
  ? HasOneInfo<
      T,
      Name,
      Rel,
      HasOneQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>
    >['dataForCreate']
  : Rel extends HasMany
    ? HasManyInfo<
        T,
        Name,
        Rel,
        HasManyQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>
      >['dataForCreate']
    : Rel extends HasAndBelongsToMany
      ? HasAndBelongsToManyInfo<
          T,
          Name,
          Rel['options']['columns'][number] & string,
          HasAndBelongsToManyQuery<Name, RelationTableToQuery<TC, VC, Rel>>
        >['dataForCreate']
      : never;

type RelationInfoForName<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
  Rel,
> = Rel extends BelongsTo
  ? BelongsToRelationInfo<TC, VC, T, Name, Rel>
  : Rel extends HasOne
    ? HasOneInfo<
        T,
        Name,
        Rel,
        HasOneQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>
      >
    : Rel extends HasMany
      ? HasManyInfo<
          T,
          Name,
          Rel,
          HasManyQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>
        >
      : Rel extends HasAndBelongsToMany
        ? HasAndBelongsToManyInfo<
            T,
            Name,
            Rel['options']['columns'][number] & string,
            HasAndBelongsToManyQuery<Name, RelationTableToQuery<TC, VC, Rel>>
          >
        : never;

type RelationDataForCreateOptionalNames<T extends RelationConfigSelf> = {
  [K in keyof T['relations'] & string]: T['relations'][K] extends BelongsTo
    ? never
    : K;
}[keyof T['relations'] & string];

type RelationDataForCreateValue<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends keyof T['relations'] & string,
> = RelationDataForCreate<TC, VC, T, Name, T['relations'][Name]>[Name];

type BelongsToRelationCreateData<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Name extends keyof T['relations'],
> = Name extends keyof T['relations'] & string
  ? T['relations'][Name] extends BelongsTo
    ? BelongsToCreateData<TC, VC, T, Name, T['relations'][Name]>
    : never
  : never;

type BelongsToRelationsDataForCreate<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
> = {
  [K in keyof T['relations'] as T['relations'][K] extends BelongsTo
    ? T['relations'][K]['options']['columns'][number] & string
    : never]: BelongsToRelationCreateData<TC, VC, T, K>;
};

type RelationsDataForCreateOptional<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends RelationConfigSelf,
  Names extends keyof T['relations'] & string =
    RelationDataForCreateOptionalNames<T>,
> = [Names] extends [never]
  ? EmptyObject
  : {
      [K in Names]?: RelationDataForCreateValue<TC, VC, T, K>;
    };

// converts table type to a queryable interface
export interface TableQueryBuilder<
  TC extends OrmTableThunks,
  VC extends OrmTableThunks,
  T extends ORMTableInput,
>
  extends
    TableInfo,
    Db<
      T['table'] extends string ? T['table'] : T['name'],
      BrandColumnsShape<
        T['columns']['shape'],
        T['table'] extends string ? T['table'] : T['name']
      >,
      T['columns']['data'],
      T['types'],
      T['table'] extends string
        ? T['readOnly'] extends true
          ? true
          : undefined
        : T['readOnly'] extends false
          ? undefined
          : true,
      T
    > {
  relations: T extends RelationConfigSelf
    ? {
        [K in keyof T['relations'] & string]: RelationInfoForName<
          TC,
          VC,
          T,
          K,
          T['relations'][K]
        >;
      }
    : EmptyObject;
  relationsDataForCreate: T extends RelationConfigSelf
    ? BelongsToRelationsDataForCreate<TC, VC, T>
    : EmptyObject;
  relationsDataForCreateOptional: T extends RelationConfigSelf
    ? RelationsDataForCreateOptional<TC, VC, T>
    : EmptyObject;
}

export interface PickORMTableInputColumns {
  // columns shape and the record type
  columns: {
    shape: Column.Shape.QueryInit;
    data: MaybeArray<TableDataItem>;
  };
}

export interface PickORMTableComputed {
  /**
   * collect computed columns returned by {@link BaseTable.setColumns}
   */
  computed?: ComputedOptionsFactory<never, never>;
}

export interface PickORMTableInputColumnsAndComputed
  extends PickORMTableInputColumns, PickORMTableComputed {}

// type of table instance created by a table class
// is used only in `orchidORM` constructor to accept proper classes
export interface ORMTableInput extends PickORMTableInputColumnsAndComputed {
  id?: string;
  autoForeignKeys?: TableData.References.BaseOptions | boolean;
  // database schema containing this table
  schema?: QuerySchema;
  // database relation name
  nameInDb?: string;
  // whether query-facing camelCase names are translated to snake_case in SQL
  snakeCase?: boolean;
  // column types defined in base table to use in `setColumns`
  types: unknown;
  // path to file where the table is defined
  filePath: string;
  // default language for the full text search
  language?: string;
  // Available scopes for this table defined by user.
  scopes?: RecordUnknown;
  // enable soft delete, true for `deletedAt` column, string for column name
  readonly softDelete?: true | string;
  // database table comment
  comment?: string;
  // row-level security table flags
  rls?: Rls.TableConfig;
  /**
   * Table-local grants used by migration generation.
   */
  grants?: readonly Grant.TableClassGrant[];
  // table-level read-only capability; only literal `true` disables mutations
  readonly readOnly?: boolean;
  // materialized-view capability; only literal `true` marks materialized views
  readonly materialized?: true;
  /**
   * Keep this table-like definition available at runtime, but exclude it from
   * generated migration DDL reconciliation.
   */
  generatorIgnore?: boolean;

  /* Only for tables */

  // table name
  table?: string;
  // suppress no primary key warning
  noPrimaryKey?: boolean;
  // automatically create foreign keys for relations

  /* Only for views */

  // view name
  name?: string;
  // Query assigned in `init(db)` to define this view.
  query?: Query;
  // Raw SQL expression that defines this view.
  sql?: string | RawSqlBase;
  // CREATE VIEW RECURSIVE option used by migration generation.
  recursive?: boolean;
  // CREATE VIEW CHECK OPTION used by migration generation.
  checkOption?: 'LOCAL' | 'CASCADED';
  // CREATE VIEW security_barrier option used by migration generation.
  securityBarrier?: boolean;
  // CREATE VIEW security_invoker option used by migration generation.
  securityInvoker?: boolean;
  // CREATE MATERIALIZED VIEW WITH DATA / WITH NO DATA option.
  withData?: boolean;
}

export interface OrmLegacyTableForTypeHelpers {
  columns: {
    shape: Column.Shape.QueryInit;
  };
  computed?: ComputedOptionsFactory<never, never>;
}

export interface OrmTableForTypeHelpers {
  data: {
    columns: Column.Shape.QueryInit;
    computed?: ComputedOptionsFactory<never, never>;
  };
}

type AnyTableForTypeHelpers =
  | OrmLegacyTableForTypeHelpers
  | OrmTableForTypeHelpers;

// Object type that's allowed in `where` and similar methods of the table.
export type Queryable<T extends AnyTableForTypeHelpers> = T extends
  | { columns: { shape: infer Shape extends Column.Shape.QueryInit } }
  | { data: { columns: infer Shape extends Column.Shape.QueryInit } }
  ? {
      [K in keyof Shape]?: Shape[K]['__queryType'];
    }
  : never;

export type DefaultSelect<T extends AnyTableForTypeHelpers> =
  T extends OrmTableForTypeHelpers
    ? ColumnsShape.DefaultOutput<T['data']['columns']>
    : T extends OrmLegacyTableForTypeHelpers
      ? ColumnsShape.DefaultOutput<T['columns']['shape']>
      : never;

type SelectableFromShapeAndComputed<
  Shape extends Column.Shape.QueryInit,
  Computed,
> = Computed extends undefined
  ? ColumnsShape.Output<Shape>
  : Computed extends ((t: never) => infer R extends ComputedOptionsConfig)
    ? ColumnsShape.Output<Shape> & {
        [K in keyof R]: R[K] extends {
          result: {
            value: infer Value extends Column.Pick.QueryColumn;
          };
        }
          ? Value['__outputType']
          : R[K] extends () => {
                result: {
                  value: infer Value extends Column.Pick.QueryColumn;
                };
              }
            ? Value['__outputType']
            : never;
      }
    : ColumnsShape.Output<Shape>;

// Object type of table's record that's returned from database and is parsed.
export type Selectable<T extends AnyTableForTypeHelpers> =
  T extends OrmTableForTypeHelpers
    ? SelectableFromShapeAndComputed<
        T['data']['columns'],
        T['data']['computed']
      >
    : T extends OrmLegacyTableForTypeHelpers
      ? SelectableFromShapeAndComputed<T['columns']['shape'], T['computed']>
      : never;

// Object type that conforms `create` method of the table.
export type Insertable<T extends AnyTableForTypeHelpers> = T extends
  | { columns: { shape: infer Shape extends Column.Shape.QueryInit } }
  | { data: { columns: infer Shape extends Column.Shape.QueryInit } }
  ? ColumnsShape.Input<Shape>
  : never;

// Object type that conforms `update` method of the table.
export type Updatable<T extends AnyTableForTypeHelpers> =
  T extends OrmTableForTypeHelpers
    ? ColumnsShape.InputPartial<T['data']['columns']>
    : T extends OrmLegacyTableForTypeHelpers
      ? ColumnsShape.InputPartial<T['columns']['shape']>
      : never;

// type of before hook function for the table
type BeforeHookMethod = (cb: QueryBeforeHook) => void;
type BeforeActionHookMethod = (cb: QueryBeforeActionHook) => void;

// type of after hook function for the table
type AfterHookMethod = (cb: QueryAfterHook) => void;

// type of after hook function that allows selecting columns for the table
type AfterSelectableHookMethod = <
  Shape extends Column.QueryColumns,
  S extends (keyof Shape)[],
>(
  this: { columns: { shape: Shape } },
  select: S,
  cb: AfterHook<S, Shape>,
) => void;

export interface SetColumnsResult<
  Shape extends Column.Shape.QueryInit,
  Data extends MaybeArray<MaybeArray<TableDataItem>>,
> {
  shape: Shape;
  data: Data extends unknown[] ? Data : [Data];
}

export interface BaseTableInstance<ColumnTypes> {
  table?: string;
  /**
   * Database relation name used in SQL and migration generation.
   */
  nameInDb?: string;
  columns: { shape: Column.Shape.QueryInit; data: MaybeArray<TableDataItem> };
  schema?: QuerySchema;
  noPrimaryKey?: boolean;
  snakeCase?: boolean;
  types: ColumnTypes;
  q: QueryData;
  language?: string;
  filePath: string;
  materialized?: true;
  /**
   * Keep this table-like definition available at runtime, but exclude it from
   * generated migration DDL reconciliation.
   */
  generatorIgnore?: true;
  result: Column.Shape.QueryInit;
  clone<T extends IsQuery>(this: T): T;
  getFilePath(): string;
  setColumns<
    Shape extends Column.Shape.QueryInit,
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
   * import { BaseTable, sql } from './baseTable';
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
   *       sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
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
   * import { sql } from './baseTable';
   *
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
   *     title: () =>
   *       // `sql` accepts a callback to generate a new query on every run
   *       sql(() => {
   *         // get locale dynamically based on current storage value
   *         const locale = asyncLanguageStorage.getStore() || defaultLocale;
   *
   *         // use COALESCE in case when localized title is NULL, use title_en
   *         return sql`COALESCE(
   *             ${q.column(`title_${locale}`)},
   *             ${q.column(`title_${defaultLocale}`)}
   *           )`;
   *       }).type((t) => t.text()),
   *   });
   * }
   * ```
   *
   * @param computed - object where keys are column names and values are functions returning raw SQL
   */
  setComputed<
    Shape extends Column.Shape.QueryInit,
    Computed extends ComputedOptionsFactory<ColumnTypes, Shape>,
  >(
    this: { columns: { shape: Shape } },
    computed: Computed,
  ): Computed;

  /**
   * See {@link ScopeMethods}
   */
  setScopes<
    Table extends string,
    Shape extends Column.Shape.QueryInit,
    Keys extends string,
  >(
    this: ({ table: Table } | { name: Table }) & { columns: { shape: Shape } },
    scopes: DbTableOptionScopes<Table, Shape, Keys>,
  ): QueryScopes<Keys>;

  belongsTo<
    Columns extends Column.Shape.QueryInit,
    Related extends ORMTableInput,
    Options extends BelongsToOptions<Columns, Related>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => { new (): Related },
    options: Options,
  ): {
    type: 'belongsTo';
    id: Related['id'] extends string
      ? Related['id']
      : Related['table'] extends string
        ? Related['table']
        : Related['name'];
    options: Options;
  };

  hasOne<
    Columns extends Column.Shape.QueryInit,
    Related extends ORMTableInput,
    Through extends string,
    Options extends HasOneOptions<Columns, Related, Through>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => { new (): Related },
    options: Options,
  ): {
    type: 'hasOne';
    id: Related['id'] extends string
      ? Related['id']
      : Related['table'] extends string
        ? Related['table']
        : Related['name'];
    options: Options;
  };

  hasMany<
    Columns extends Column.Shape.QueryInit,
    Related extends ORMTableInput,
    Through extends string,
    Options extends HasOneOptions<Columns, Related, Through>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => { new (): Related },
    options: Options,
  ): {
    type: 'hasMany';
    id: Related['id'] extends string
      ? Related['id']
      : Related['table'] extends string
        ? Related['table']
        : Related['name'];
    options: Options;
  };

  hasAndBelongsToMany<
    Columns extends Column.Shape.QueryInit,
    Related extends ORMTableInput,
    Options extends HasAndBelongsToManyOptions<Columns, Related>,
  >(
    this: { columns: { shape: Columns } },
    fn: () => { new (): Related },
    options: Options,
  ): {
    type: 'hasAndBelongsToMany';
    id: Related['id'] extends string
      ? Related['id']
      : Related['table'] extends string
        ? Related['table']
        : Related['name'];
    options: Options;
  };

  beforeQuery: BeforeHookMethod;
  afterQuery: AfterHookMethod;
  beforeCreate: BeforeActionHookMethod;
  afterCreate: AfterSelectableHookMethod;
  afterCreateCommit: AfterSelectableHookMethod;
  beforeUpdate: BeforeActionHookMethod;
  afterUpdate: AfterSelectableHookMethod;
  afterUpdateCommit: AfterSelectableHookMethod;
  beforeSave: BeforeActionHookMethod;
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

  sql: DbSqlMethod<ColumnTypes>;
  View: TableClass<BaseViewInstance<ColumnTypes>>;
  MaterializedView: TableClass<BaseMaterializedViewInstance<ColumnTypes>>;

  new (): BaseTableInstance<ColumnTypes>;
  instance(): BaseTableInstance<ColumnTypes>;

  /**
   * All column types for inserting.
   */
  inputSchema: SchemaConfig['inputSchema'];
  /**
   * All column types as returned from a database.
   */
  outputSchema: SchemaConfig['outputSchema'];
  /**
   * All column types for query methods such as `where`.
   */
  querySchema: SchemaConfig['querySchema'];
  /**
   * Primary key column(s) type for query methods such as `where`.
   */
  pkeySchema: SchemaConfig['pkeySchema'];
  /**
   * Column types for inserting, excluding primary keys.
   * Equals to {@link inputSchema} without primary keys.
   */
  createSchema: SchemaConfig['createSchema'];
  /**
   * Column types for updating, excluding primary keys.
   * Equals to partial {@link createSchema}.
   */
  updateSchema: SchemaConfig['updateSchema'];
}

export interface BaseViewInstance<
  ColumnTypes,
> extends BaseTableInstance<ColumnTypes> {
  name: string;
  query?: Query;
  sql: string | RawSqlBase;
  readonly readOnly?: boolean;
  recursive?: boolean;
  checkOption?: 'LOCAL' | 'CASCADED';
  securityBarrier?: boolean;
  securityInvoker?: boolean;
}

export interface BaseMaterializedViewInstance<
  ColumnTypes,
> extends BaseTableInstance<ColumnTypes> {
  name: string;
  query?: Query;
  sql: string | RawSqlBase;
  readonly readOnly?: true;
  readonly materialized: true;
  withData?: boolean;
}

// base table constructor
export function createBaseTable<
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  schemaConfig = defaultSchemaConfig as unknown as () => SchemaConfig,
  columnTypes: columnTypesArg,
  snakeCase,
  filePath: filePathArg,
  nowSQL,
  exportAs = 'BaseTable',
  language,
  autoForeignKeys,
}: CommonTableFactoryOptions<SchemaConfig, ColumnTypes> = {}): BaseTableClass<
  SchemaConfig,
  ColumnTypes
> {
  const schema = schemaConfig();

  const columnTypes = (
    typeof columnTypesArg === 'function'
      ? // oxlint-disable-next-line typescript/no-explicit-any
        (columnTypesArg as any)(makeColumnTypes(schema))
      : columnTypesArg || makeColumnTypes(schema)
  ) as ColumnTypes;

  // stack is needed only if filePath wasn't given
  const filePathOrStack = filePathArg || getStackTrace();

  let filePath: string | undefined;

  const defaultColumns: {
    shape: Column.Shape.QueryInit;
    data: MaybeArray<TableDataItem>;
  } = {
    shape: emptyObject,
    data: emptyArray,
  };

  const instances = new WeakMap<typeof base, InstanceType<typeof base>>();

  const base = class BaseTable {
    static nowSQL = nowSQL;
    static exportAs = exportAs;
    static columnTypes = columnTypes;

    static sql = _createDbSqlMethod(columnTypes);

    private static _inputSchema: unknown;
    static inputSchema() {
      this.instance();
      // Nullish coalescing assignment (??=), for some reason, compiles to != null and miss undefined
      return this._inputSchema === undefined
        ? (this._inputSchema = schema.inputSchema.call(this as never))
        : this._inputSchema;
    }

    private static _outputSchema: unknown;
    static outputSchema() {
      this.instance();
      return this._outputSchema === undefined
        ? (this._outputSchema = schema.outputSchema.call(this as never))
        : this._outputSchema;
    }

    private static _querySchema: unknown;
    static querySchema() {
      this.instance();
      return this._querySchema === undefined
        ? (this._querySchema = schema.querySchema.call(this as never))
        : this._querySchema;
    }

    private static _createSchema: unknown;
    static createSchema() {
      this.instance();
      return this._createSchema === undefined
        ? (this._createSchema = schema.createSchema.call(this as never))
        : this._createSchema;
    }

    private static _updateSchema: unknown;
    static updateSchema() {
      this.instance();
      return this._updateSchema === undefined
        ? (this._updateSchema = schema.updateSchema.call(this as never))
        : this._updateSchema;
    }

    private static _pkeySchema: unknown;
    static pkeySchema() {
      this.instance();
      return this._pkeySchema === undefined
        ? (this._pkeySchema = schema.pkeySchema.call(this as never))
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

    static instance(): BaseTable {
      let instance = instances.get(this);
      if (!instance) {
        instance = new this();
        const name = instance.table || instance.name;
        if (instance.nameInDb === undefined && name) {
          instance.nameInDb = instance.snakeCase ? toSnakeCase(name) : name;
        }
        instances.set(this, instance);
      }

      return instance;
    }

    table!: string;
    name!: string;
    nameInDb?: string;
    query?: Query;
    sql!: string | RawSqlBase;
    columns = defaultColumns;
    schema?: QuerySchema;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    types = columnTypes;
    q: QueryData = {} as QueryData;
    language = language;
    declare filePath: string;
    declare result: Column.Shape.QueryInit;
    declare autoForeignKeys?: TableData.References.BaseOptions;

    clone<T extends IsQuery>(this: T): T {
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
      Shape extends Column.Shape.QueryInit,
      Data extends MaybeArray<TableDataItem>,
    >(
      fn: (t: ColumnTypes) => Shape,
      dataFn?: TableDataFn<Shape, Data>,
    ): SetColumnsResult<Shape, Data> {
      const shape = getColumnTypes(columnTypes, fn, nowSQL, this.language);
      const tableData = parseTableData(dataFn);

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

    setComputed(computed: unknown) {
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

  const baseWithView = base as typeof base & {
    View: typeof base;
    MaterializedView: typeof base;
  };

  baseWithView.View = class View extends base {
    readonly readOnly = true;
  };

  baseWithView.MaterializedView = class MaterializedView extends (
    baseWithView.View
  ) {
    readonly materialized = true;
  };

  base.prototype.types = columnTypes as typeof base.prototype.types;
  base.prototype.snakeCase = snakeCase;
  base.prototype.language = language;
  base.prototype.autoForeignKeys =
    autoForeignKeys === true ? {} : autoForeignKeys || undefined;

  return base as unknown as BaseTableClass<SchemaConfig, ColumnTypes>;
}
