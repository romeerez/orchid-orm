import { Column, AfterHook, ComputedOptionsConfig, ComputedOptionsFactory, DbSqlMethod, DbTableOptionScopes, DefaultColumnTypes, DefaultSchemaConfig, QueryAfterHook, QueryBeforeActionHook, QueryBeforeHook, QueryData, QueryScopes, TableData, TableDataFn, TableDataItem, ColumnSchemaConfig, EmptyObject, IsQuery, MaybeArray, RecordUnknown, ColumnsShape, QuerySchema, Rls, Grant, type RawSqlBase } from 'pqb/internal';
import { RelationConfigSelf, RelationToTableInput, RelationTableToQuery } from '../relations/relations';
import { OrchidORM, OrmTableThunks } from '../orm';
import { BelongsTo, BelongsToDataForCreate, BelongsToDefaultRequired, BelongsToInfo, BelongsToOptions, BelongsToQuery } from '../relations/belongsTo';
import { HasOne, HasOneInfo, HasOneOptions, HasOneQuery } from '../relations/hasOne';
import { HasAndBelongsToMany, HasAndBelongsToManyInfo, HasAndBelongsToManyOptions, HasAndBelongsToManyQuery } from '../relations/hasAndBelongsToMany';
import { HasMany, HasManyInfo, HasManyQuery } from '../relations/hasMany';
import { Db, Query } from 'pqb';
import { TableFactoryOptions } from './table.common';
export interface TableClass<T extends ORMTableInput = ORMTableInput> {
    new (): T;
}
export interface TableInfo {
    definedAs: string;
    db: OrchidORM;
    getFilePath(): string;
    name: string;
}
export interface Table extends Query, TableInfo {
}
type BelongsToRequired<T extends RelationConfigSelf, Rel extends BelongsTo, Related> = Rel['options'] extends {
    required: infer Required extends boolean;
} ? Required : Rel['options'] extends {
    on: unknown;
} ? false : BelongsToDefaultRequired<T, Rel, Related>;
type BelongsToRelationInfo<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends string, Rel extends BelongsTo> = RelationToTableInput<TC, VC, Rel> extends infer Related extends ORMTableInput ? BelongsToInfo<T, Rel['options']['columns'][number] & string, BelongsToRequired<T, Rel, Related>, BelongsToQuery<TableQueryBuilder<TC, VC, Related>, Name>> : never;
type BelongsToCreateData<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends string, Rel extends BelongsTo> = RelationToTableInput<TC, VC, Rel> extends infer Related extends ORMTableInput ? BelongsToDataForCreate<Name, Rel['options']['columns'][number] & string, BelongsToRequired<T, Rel, Related>, BelongsToQuery<TableQueryBuilder<TC, VC, Related>, Name>> : never;
type RelationDataForCreate<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends keyof T['relations'] & string, Rel> = Rel extends HasOne ? HasOneInfo<T, Name, Rel, HasOneQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>>['dataForCreate'] : Rel extends HasMany ? HasManyInfo<T, Name, Rel, HasManyQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>>['dataForCreate'] : Rel extends HasAndBelongsToMany ? HasAndBelongsToManyInfo<T, Name, Rel['options']['columns'][number] & string, HasAndBelongsToManyQuery<Name, RelationTableToQuery<TC, VC, Rel>>>['dataForCreate'] : never;
type RelationInfoForName<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends keyof T['relations'] & string, Rel> = Rel extends BelongsTo ? BelongsToRelationInfo<TC, VC, T, Name, Rel> : Rel extends HasOne ? HasOneInfo<T, Name, Rel, HasOneQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>> : Rel extends HasMany ? HasManyInfo<T, Name, Rel, HasManyQuery<T, Name, RelationTableToQuery<TC, VC, Rel>>> : Rel extends HasAndBelongsToMany ? HasAndBelongsToManyInfo<T, Name, Rel['options']['columns'][number] & string, HasAndBelongsToManyQuery<Name, RelationTableToQuery<TC, VC, Rel>>> : never;
type RelationDataForCreateOptionalNames<T extends RelationConfigSelf> = {
    [K in keyof T['relations'] & string]: T['relations'][K] extends BelongsTo ? never : K;
}[keyof T['relations'] & string];
type RelationDataForCreateValue<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends keyof T['relations'] & string> = RelationDataForCreate<TC, VC, T, Name, T['relations'][Name]>[Name];
type BelongsToRelationCreateData<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Name extends keyof T['relations']> = Name extends keyof T['relations'] & string ? T['relations'][Name] extends BelongsTo ? BelongsToCreateData<TC, VC, T, Name, T['relations'][Name]> : never : never;
type BelongsToRelationsDataForCreate<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf> = {
    [K in keyof T['relations'] as T['relations'][K] extends BelongsTo ? T['relations'][K]['options']['columns'][number] & string : never]: BelongsToRelationCreateData<TC, VC, T, K>;
};
type RelationsDataForCreateOptional<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends RelationConfigSelf, Names extends keyof T['relations'] & string = RelationDataForCreateOptionalNames<T>> = [Names] extends [never] ? EmptyObject : {
    [K in Names]?: RelationDataForCreateValue<TC, VC, T, K>;
};
export interface TableQueryBuilder<TC extends OrmTableThunks, VC extends OrmTableThunks, T extends ORMTableInput> extends TableInfo, Db<T['table'] extends string ? T['table'] : T['name'], T['columns']['shape'], T['columns']['data'], T['types'], T['table'] extends string ? T['readOnly'] extends true ? true : undefined : T['readOnly'] extends false ? undefined : true, T> {
    relations: T extends RelationConfigSelf ? {
        [K in keyof T['relations'] & string]: RelationInfoForName<TC, VC, T, K, T['relations'][K]>;
    } : EmptyObject;
    relationsDataForCreate: T extends RelationConfigSelf ? BelongsToRelationsDataForCreate<TC, VC, T> : EmptyObject;
    relationsDataForCreateOptional: T extends RelationConfigSelf ? RelationsDataForCreateOptional<TC, VC, T> : EmptyObject;
}
export interface PickORMTableInputColumns {
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
export interface PickORMTableInputColumnsAndComputed extends PickORMTableInputColumns, PickORMTableComputed {
}
export interface ORMTableInput extends PickORMTableInputColumnsAndComputed {
    id?: string;
    autoForeignKeys?: TableData.References.BaseOptions | boolean;
    schema?: QuerySchema;
    nameInDb?: string;
    snakeCase?: boolean;
    types: unknown;
    filePath: string;
    language?: string;
    scopes?: RecordUnknown;
    readonly softDelete?: true | string;
    comment?: string;
    rls?: Rls.TableConfig;
    /**
     * Table-local grants used by migration generation.
     */
    grants?: readonly Grant.TableClassGrant[];
    readonly readOnly?: boolean;
    readonly materialized?: true;
    /**
     * Keep this table-like definition available at runtime, but exclude it from
     * generated migration DDL reconciliation.
     */
    generatorIgnore?: true;
    table?: string;
    noPrimaryKey?: boolean;
    name?: string;
    query?: Query;
    sql?: string | RawSqlBase;
    recursive?: boolean;
    checkOption?: 'LOCAL' | 'CASCADED';
    securityBarrier?: boolean;
    securityInvoker?: boolean;
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
type AnyTableForTypeHelpers = OrmLegacyTableForTypeHelpers | OrmTableForTypeHelpers;
export type Queryable<T extends AnyTableForTypeHelpers> = T extends {
    columns: {
        shape: infer Shape extends Column.Shape.QueryInit;
    };
} | {
    data: {
        columns: infer Shape extends Column.Shape.QueryInit;
    };
} ? {
    [K in keyof Shape]?: Shape[K]['__queryType'];
} : never;
export type DefaultSelect<T extends AnyTableForTypeHelpers> = T extends OrmTableForTypeHelpers ? ColumnsShape.DefaultOutput<T['data']['columns']> : T extends OrmLegacyTableForTypeHelpers ? ColumnsShape.DefaultOutput<T['columns']['shape']> : never;
type SelectableFromShapeAndComputed<Shape extends Column.Shape.QueryInit, Computed> = Computed extends undefined ? ColumnsShape.Output<Shape> : Computed extends ((t: never) => infer R extends ComputedOptionsConfig) ? ColumnsShape.Output<Shape> & {
    [K in keyof R]: R[K] extends {
        result: {
            value: infer Value extends Column.Pick.QueryColumn;
        };
    } ? Value['__outputType'] : R[K] extends () => {
        result: {
            value: infer Value extends Column.Pick.QueryColumn;
        };
    } ? Value['__outputType'] : never;
} : ColumnsShape.Output<Shape>;
export type Selectable<T extends AnyTableForTypeHelpers> = T extends OrmTableForTypeHelpers ? SelectableFromShapeAndComputed<T['data']['columns'], T['data']['computed']> : T extends OrmLegacyTableForTypeHelpers ? SelectableFromShapeAndComputed<T['columns']['shape'], T['computed']> : never;
export type Insertable<T extends AnyTableForTypeHelpers> = T extends {
    columns: {
        shape: infer Shape extends Column.Shape.QueryInit;
    };
} | {
    data: {
        columns: infer Shape extends Column.Shape.QueryInit;
    };
} ? ColumnsShape.Input<Shape> : never;
export type Updatable<T extends AnyTableForTypeHelpers> = T extends OrmTableForTypeHelpers ? ColumnsShape.InputPartial<T['data']['columns']> : T extends OrmLegacyTableForTypeHelpers ? ColumnsShape.InputPartial<T['columns']['shape']> : never;
type BeforeHookMethod = (cb: QueryBeforeHook) => void;
type BeforeActionHookMethod = (cb: QueryBeforeActionHook) => void;
type AfterHookMethod = (cb: QueryAfterHook) => void;
type AfterSelectableHookMethod = <Shape extends Column.QueryColumns, S extends (keyof Shape)[]>(this: {
    columns: {
        shape: Shape;
    };
}, select: S, cb: AfterHook<S, Shape>) => void;
export interface SetColumnsResult<Shape extends Column.Shape.QueryInit, Data extends MaybeArray<MaybeArray<TableDataItem>>> {
    shape: Shape;
    data: Data extends unknown[] ? Data : [Data];
}
export interface BaseTableInstance<ColumnTypes> {
    table?: string;
    /**
     * Database relation name used in SQL and migration generation.
     */
    nameInDb?: string;
    columns: {
        shape: Column.Shape.QueryInit;
        data: MaybeArray<TableDataItem>;
    };
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
    setColumns<Shape extends Column.Shape.QueryInit, Data extends MaybeArray<TableDataItem>>(fn: (t: ColumnTypes) => Shape, tableData?: TableDataFn<Shape, Data>): SetColumnsResult<Shape, Data>;
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
    setComputed<Shape extends Column.Shape.QueryInit, Computed extends ComputedOptionsFactory<ColumnTypes, Shape>>(this: {
        columns: {
            shape: Shape;
        };
    }, computed: Computed): Computed;
    /**
     * See {@link ScopeMethods}
     */
    setScopes<Table extends string, Shape extends Column.Shape.QueryInit, Keys extends string>(this: ({
        table: Table;
    } | {
        name: Table;
    }) & {
        columns: {
            shape: Shape;
        };
    }, scopes: DbTableOptionScopes<Table, Shape, Keys>): QueryScopes<Keys>;
    belongsTo<Columns extends Column.Shape.QueryInit, Related extends ORMTableInput, Options extends BelongsToOptions<Columns, Related>>(this: {
        columns: {
            shape: Columns;
        };
    }, fn: () => {
        new (): Related;
    }, options: Options): {
        type: 'belongsTo';
        id: Related['id'] extends string ? Related['id'] : Related['table'] extends string ? Related['table'] : Related['name'];
        options: Options;
    };
    hasOne<Columns extends Column.Shape.QueryInit, Related extends ORMTableInput, Through extends string, Options extends HasOneOptions<Columns, Related, Through>>(this: {
        columns: {
            shape: Columns;
        };
    }, fn: () => {
        new (): Related;
    }, options: Options): {
        type: 'hasOne';
        id: Related['id'] extends string ? Related['id'] : Related['table'] extends string ? Related['table'] : Related['name'];
        options: Options;
    };
    hasMany<Columns extends Column.Shape.QueryInit, Related extends ORMTableInput, Through extends string, Options extends HasOneOptions<Columns, Related, Through>>(this: {
        columns: {
            shape: Columns;
        };
    }, fn: () => {
        new (): Related;
    }, options: Options): {
        type: 'hasMany';
        id: Related['id'] extends string ? Related['id'] : Related['table'] extends string ? Related['table'] : Related['name'];
        options: Options;
    };
    hasAndBelongsToMany<Columns extends Column.Shape.QueryInit, Related extends ORMTableInput, Options extends HasAndBelongsToManyOptions<Columns, Related>>(this: {
        columns: {
            shape: Columns;
        };
    }, fn: () => {
        new (): Related;
    }, options: Options): {
        type: 'hasAndBelongsToMany';
        id: Related['id'] extends string ? Related['id'] : Related['table'] extends string ? Related['table'] : Related['name'];
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
export interface BaseTableClass<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> {
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
export interface BaseViewInstance<ColumnTypes> extends BaseTableInstance<ColumnTypes> {
    name: string;
    query?: Query;
    sql: string | RawSqlBase;
    readonly readOnly?: boolean;
    recursive?: boolean;
    checkOption?: 'LOCAL' | 'CASCADED';
    securityBarrier?: boolean;
    securityInvoker?: boolean;
}
export interface BaseMaterializedViewInstance<ColumnTypes> extends BaseTableInstance<ColumnTypes> {
    name: string;
    query?: Query;
    sql: string | RawSqlBase;
    readonly readOnly?: true;
    readonly materialized: true;
    withData?: boolean;
}
export declare function createBaseTable<SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig, ColumnTypes = DefaultColumnTypes<SchemaConfig>>({ schemaConfig, columnTypes: columnTypesArg, snakeCase, filePath: filePathArg, nowSQL, exportAs, language, autoForeignKeys, }?: TableFactoryOptions<SchemaConfig, ColumnTypes>): BaseTableClass<SchemaConfig, ColumnTypes>;
export {};
