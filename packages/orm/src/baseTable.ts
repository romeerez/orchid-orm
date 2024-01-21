import {
  AfterHook,
  makeColumnTypes,
  ComputedColumnsBase,
  Db,
  DbTableOptionScopes,
  DefaultColumnTypes,
  getColumnTypes,
  MapTableScopesOption,
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
  ColumnShapeInput,
  ColumnShapeOutput,
  ColumnShapeQueryType,
  ColumnsShapeBase,
  EmptyObject,
  getCallerFilePath,
  getStackTrace,
  CoreQueryScopes,
  snakeCaseKey,
  toSnakeCase,
  ColumnSchemaConfig,
} from 'orchid-core';
import { MapRelations } from './relations/relations';
import { OrchidORM } from './orm';
import { BelongsToOptions } from './relations/belongsTo';
import { HasOneOptions } from './relations/hasOne';
import { HasManyOptions } from './relations/hasMany';
import { HasAndBelongsToManyOptions } from './relations/hasAndBelongsToMany';
import { defaultSchemaConfig, DefaultSchemaConfig } from 'pqb';

// type of table class itself
export type TableClass<T extends Table = Table> = {
  new (): T;
  instance(): T;
};

// object with table classes, used on orchidORM() for setting tables
export type TableClasses = Record<string, TableClass>;

// convert table instance type to queryable interface
// processes relations to a type that's understandable by `pqb`
// add ORM table specific metadata like `definedAt`, `db`, `getFilePath`
export type TableToDb<
  T extends Table,
  RelationQueries extends Record<string, RelationQueryBase>,
> = Db<
  T['table'],
  T['columns'],
  RelationQueries,
  T['types'],
  T['computed'] extends ComputedColumnsBase<never>
    ? T['columns'] & {
        [K in keyof T['computed']]: ReturnType<T['computed'][K]>['_type'];
      }
    : T['columns'],
  MapTableScopesOption<T['scopes'], T['softDelete']>
> & {
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
// callback with a query of relation, to use as a default scope
export type ScopeFn<Related extends TableClass, Scope extends Query> = (
  q: DbTable<Related>,
) => Scope;

// type of table instance created by a table class
export type Table = {
  // table name
  table: string;
  // columns shape and the record type
  columns: ColumnsShapeBase;
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
};

// Object type that's allowed in `where` and similar methods of the table.
export type Queryable<T extends Table> = Partial<
  ColumnShapeQueryType<T['columns']>
>;

// Object type of table's record that's returned from database and is parsed.
export type Selectable<T extends Table> = ColumnShapeOutput<T['columns']>;

// Object type that conforms `create` method of the table.
export type Insertable<T extends Table> = ColumnShapeInput<T['columns']>;

// Object type that conforms `update` method of the table.
export type Updateable<T extends Table> = Partial<Insertable<T>>;

// type of before hook function for the table
type BeforeHookMethod = <T extends Table>(cb: QueryBeforeHook) => T;

// type of after hook function for the table
type AfterHookMethod = <T extends Table>(cb: QueryAfterHook) => T;

// type of after hook function that allows selecting columns for the table
type AfterSelectableHookMethod = <
  T extends Table,
  S extends (keyof T['columns'])[],
>(
  this: T,
  select: S,
  cb: AfterHook<S, T['columns']>,
) => T;

export interface BaseTableInstance<ColumnTypes> {
  table: string;
  columns: ColumnsShapeBase;
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
  setColumns<T extends ColumnsShapeBase>(fn: (t: ColumnTypes) => T): T;

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
      Db<Table, Shape, EmptyObject, ColumnTypes>
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
    this: { table: Table; columns: Columns },
    scopes: DbTableOptionScopes<Table, Columns, Keys>,
  ): CoreQueryScopes<Keys>;

  belongsTo<
    Columns extends ColumnsShapeBase,
    Related extends TableClass,
    Scope extends Query,
    Options extends BelongsToOptions<Columns, Related, Scope>,
  >(
    this: { columns: Columns },
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
    this: { columns: Columns },
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
    this: { columns: Columns },
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
    this: { columns: Columns },
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
      : columnTypesArg || makeColumnTypes(defaultSchemaConfig)
  ) as ColumnTypes;

  // stack is needed only if filePath wasn't given
  const filePathOrStack = filePathArg || getStackTrace();

  let filePath: string | undefined;

  let inputSchema: unknown;
  let outputSchema: unknown;
  let querySchema: unknown;

  const base = class BaseTable {
    static nowSQL = nowSQL;
    static exportAs = exportAs;

    static inputSchema() {
      return (inputSchema ??= schemaConfig.inputSchema.call(this));
    }

    static outputSchema() {
      return (outputSchema ??= schemaConfig.outputSchema.call(this));
    }

    static querySchema() {
      return (querySchema ??= schemaConfig.querySchema.call(this));
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
    columns!: ColumnsShapeBase;
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

    setColumns<T extends ColumnsShapeBase>(fn: (t: ColumnTypes) => T): T {
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

      return shape;
    }

    setComputed<
      Table extends string,
      Shape extends ColumnsShapeBase,
      Computed extends ComputedColumnsBase<
        Db<Table, Shape, EmptyObject, ColumnTypes>
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
