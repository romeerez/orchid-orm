import {
  AfterHook,
  ColumnsShape,
  columnTypes as defaultColumnTypes,
  ComputedColumnsBase,
  Db,
  DefaultColumnTypes,
  getColumnTypes,
  Query,
  QueryAfterHook,
  QueryBase,
  QueryBeforeHook,
  QueryData,
  QueryDefaultReturnData,
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
  ColumnTypesBase,
  EmptyObject,
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
> = Db<
  T['table'],
  T['computed'] extends ComputedColumnsBase<never>
    ? T['columns'] & {
        [K in keyof T['computed']]: ReturnType<T['computed'][K]>['_type'];
      }
    : T['columns'],
  RelationQueries,
  T['types'],
  QueryDefaultReturnData<T['columns']>
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
  columns: ColumnsShape;
  // database schema containing this table
  schema?: string;
  // column types defined in base table to use in `setColumns`
  types: ColumnTypesBase;
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
    columns!: ColumnsShape;
    schema?: string;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    types = columnTypes;
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

    setColumns<T extends ColumnsShape>(fn: (t: CT) => T): T {
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
      return (this.constructor.prototype.columns = shape);
    }

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
      Shape extends ColumnsShape,
      Computed extends ComputedColumnsBase<Db<Table, Shape, EmptyObject, CT>>,
    >(computed: Computed): Computed {
      return computed;
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

  base.prototype.types = columnTypes as typeof base.prototype.types;

  return base;
};
