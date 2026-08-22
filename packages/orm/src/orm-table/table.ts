import {
  AfterHook,
  ColumnSchemaConfig,
  _createDbSqlMethod,
  ColumnsShape,
  DbSqlMethod,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  ComputedOptionsFactory,
  defaultSchemaConfig,
  DbTableOptionScopes,
  getColumnTypes,
  getCallerFilePath,
  getStackTrace,
  Grant,
  makeColumnTypes,
  QueryAfterHook,
  QueryBeforeHook,
  QueryData,
  QueryHooks,
  QueryOrExpression,
  QuerySchema,
  MaybeArray,
  RecordUnknown,
  Rls,
  RlsPolicy,
  TableData,
  type TableDataItem,
  parseTableDataInput,
  tableDataMethods,
  type RawSqlBase,
  toSnakeCase,
} from 'pqb/internal';
import type { Query } from 'pqb';
import { ORMTableInput } from './legacy-table';
import type { CommonTableFactoryOptions } from './table.common';
import type { OrchidORM } from '../orm-instance/orm-instance';

export interface TableFactoryOptions<
  SchemaConfig extends ColumnSchemaConfig,
  ColumnTypes,
> extends CommonTableFactoryOptions<SchemaConfig, ColumnTypes> {
  /** Default database schema for tables created by this factory. */
  schema?: QuerySchema;
  /** Default no-primary-key setting for tables created by this factory. */
  noPrimaryKey?: boolean;
  /** Default migration-generation ignore setting for tables created by this factory. */
  generatorIgnore?: boolean;
}

export interface OrmTable<
  Id extends string,
  Table extends string,
  Columns extends ColumnsShape,
  Relations,
  ColumnTypes = unknown,
  Computed = undefined,
  Scopes extends RecordUnknown | undefined = undefined,
  SoftDelete extends true | string | undefined = undefined,
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  Data extends MaybeArray<TableDataItem> = never,
  ReadOnly extends boolean | undefined = boolean | undefined,
> {
  data: {
    id: Id;
    name: undefined;
    table: Table;
    relations: Relations;
    columns: Columns;
    types: ColumnTypes;
    computed: Computed;
    scopes: Scopes;
    softDelete: SoftDelete;
    readOnly: ReadOnly;
    materialized: undefined;
    tableData: Data extends unknown[] ? Data : [Data];
  };
  prototype: {
    columns: {
      shape: Columns;
    };
  };
  inputSchema: SchemaConfig['inputSchema'];
  outputSchema: SchemaConfig['outputSchema'];
  querySchema: SchemaConfig['querySchema'];
  pkeySchema: SchemaConfig['pkeySchema'];
  createSchema: SchemaConfig['createSchema'];
  updateSchema: SchemaConfig['updateSchema'];
  instance(): ORMTableInput;
  exportAs: string;
  nowSQL?: string;

  <C extends (keyof Columns & string)[]>(
    ...columns: C
  ): OrmTable.Relations.Endpoint<Id, C, ColumnsShape.InputPartial<Columns>>;

  where<T>(this: T, conditions: ColumnsShape.InputPartial<Columns>): T;

  through<Through extends string>(
    through: Through,
    source: string,
  ): OrmTable.Relations.Through<
    Id,
    Through,
    ColumnsShape.InputPartial<Columns>
  >;

  primaryKey<
    Column extends keyof Columns & string,
    PrimaryKeyColumns extends [Column, ...Column[]],
    Name extends string,
  >(
    columns: PrimaryKeyColumns,
    name?: Name,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Computed,
    Scopes,
    SoftDelete,
    SchemaConfig,
    Data | OrmTable.DataItemWithColumns<PrimaryKeyColumns, Name>,
    ReadOnly
  >;

  index(
    columns: OrmTable.IndexColumn<Columns>[],
    options?: TableData.Index.OptionsArg,
  ): this;

  searchIndex(
    columns: OrmTable.IndexColumn<Columns>[],
    options?: TableData.Index.TsVectorArg,
  ): this;

  unique<
    Items extends [
      OrmTable.IndexColumn<Columns>,
      ...OrmTable.IndexColumn<Columns>[],
    ],
    Name extends string,
  >(
    columns: Items,
    options?: TableData.Index.UniqueOptionsArg<Name>,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Computed,
    Scopes,
    SoftDelete,
    SchemaConfig,
    Data | OrmTable.DataItemWithColumns<Items, Name>,
    ReadOnly
  >;

  exclude(
    columns: OrmTable.ExcludeColumn<Columns>[],
    options?: TableData.Exclude.Options,
  ): this;

  check(check: RawSqlBase, name?: string): this;

  softDelete(): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Computed,
    Scopes,
    true,
    SchemaConfig,
    Data,
    ReadOnly
  >;
  softDelete<Column extends keyof Columns & string>(
    column: Column,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Computed,
    Scopes,
    Column,
    SchemaConfig,
    Data,
    ReadOnly
  >;

  computed<Fn extends ComputedOptionsFactory<ColumnTypes, Columns>>(
    computed: Fn,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Fn,
    Scopes,
    SoftDelete,
    SchemaConfig,
    Data,
    ReadOnly
  >;

  scopes<Keys extends string>(
    scopes: DbTableOptionScopes<Table, Columns, Keys>,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Relations,
    ColumnTypes,
    Computed,
    DbTableOptionScopes<Table, Columns, Keys>,
    SoftDelete,
    SchemaConfig,
    Data,
    ReadOnly
  >;

  grants(grants: readonly Grant.TableClassGrant[]): this;

  rls(rls: OrmTable.RlsConfig): this;

  init(fn: OrmTable.Init<Columns>): this;

  foreignKey<
    Column extends keyof Columns,
    ForeignTable extends { data: { columns: ColumnsShape } },
    ForeignColumn extends keyof ForeignTable['data']['columns'],
  >(
    columns: [Column, ...Column[]],
    fnOrTable: () => ForeignTable,
    foreignColumns: [ForeignColumn, ...ForeignColumn[]],
    options?: TableData.References.Options,
  ): this;
  foreignKey<Column extends keyof Columns>(
    columns: [Column, ...Column[]],
    fnOrTable: string,
    foreignColumns: [string, ...string[]],
    options?: TableData.References.Options,
  ): this;

  // oxlint-disable-next-line typescript/no-explicit-any
  relations<Fn extends (self: OrmTable.Relations.Arg<keyof Columns>) => any>(
    fn: Fn,
  ): OrmTable<
    Id,
    Table,
    Columns,
    Fn,
    ColumnTypes,
    Computed,
    Scopes,
    SoftDelete,
    SchemaConfig,
    Data,
    ReadOnly
  >;
}

export namespace OrmTable {
  export interface RlsConfig extends Rls.TableConfigBase {
    // Permissive policies for the table.
    permit: RlsPolicy.Policy[];
    // Restrictive policies for the table.
    restrict?: RlsPolicy.Policy[];
  }

  type DataKey<Columns extends ColumnsShape> = keyof Columns & string;

  export type IndexColumn<Columns extends ColumnsShape> =
    | DataKey<Columns>
    | TableData.Index.ColumnOrExpressionOptions<DataKey<Columns>>;

  export type ExcludeColumn<Columns extends ColumnsShape> =
    TableData.Exclude.ColumnOrExpressionOptions<DataKey<Columns>>;

  export interface DataItemWithColumns<
    Columns extends unknown[],
    Name extends string,
  > {
    tableDataItem: true;
    columns: Columns;
    name: string extends Name ? never : Name;
  }

  export interface RelationEndpointData {
    id: string;
    data?: { id: string };
    columns: string[];
    on?: RecordUnknown;
    through?: string;
    source?: string;
    relationThrough?: string;
    relationSource?: string;
  }

  export interface Input<
    Id extends string,
    Table extends string | undefined,
    Name extends string | undefined,
    Columns extends ColumnsShape,
    ColumnTypes,
    Relations,
    Computed,
    Scopes extends RecordUnknown | undefined,
    SoftDelete extends true | string | undefined,
    ReadOnly extends boolean | undefined,
    Materialized extends true | undefined = true | undefined,
    TableDataItems extends MaybeArray<TableDataItem> =
      MaybeArray<TableDataItem>,
  > extends ORMTableInput {
    id: Id;
    table: Table;
    name: Name;
    types: ColumnTypes;
    readonly readOnly: ReadOnly;
    readonly materialized: Materialized;
    readonly softDelete: SoftDelete;
    columns: {
      shape: Columns;
      data: TableDataItems extends unknown[]
        ? TableDataItems
        : [TableDataItems];
    };
    relations: Relations;
    computed: Computed extends ComputedOptionsFactory<never, never>
      ? Computed
      : undefined;
    scopes: Scopes extends undefined ? undefined : Scopes;
  }

  export interface TableFactoryKit<
    SchemaConfig extends ColumnSchemaConfig,
    ColumnTypes,
  > {
    defineTable: DefineTable<SchemaConfig, ColumnTypes>;
    defineView: DefineView<SchemaConfig, ColumnTypes>;
    sql: DbSqlMethod<ColumnTypes>;
    exportAs: string;
  }

  export interface BeforeActionHookUtils<Columns extends ColumnsShape> {
    /**
     * Sets column values before a create, update, or save action.
     */
    set(data: {
      [K in keyof ColumnsShape.InputPartial<Columns>]?:
        | ColumnsShape.InputPartial<Columns>[K]
        | (() => QueryOrExpression<ColumnsShape.InputPartial<Columns>[K]>);
    }): void;
  }

  export interface InitHooks<Columns extends ColumnsShape> {
    /**
     * Registers a hook to run before every query.
     */
    beforeQuery(cb: QueryBeforeHook): void;
    /**
     * Registers a hook to run after every query.
     */
    afterQuery(cb: QueryAfterHook): void;
    /**
     * Registers a hook to run before create actions.
     */
    beforeCreate(
      cb: (utils: BeforeActionHookUtils<Columns>) => void | Promise<void>,
    ): void;
    /**
     * Registers a hook to run after create actions.
     */
    afterCreate<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run after create commits.
     */
    afterCreateCommit<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run before update actions.
     */
    beforeUpdate(
      cb: (utils: BeforeActionHookUtils<Columns>) => void | Promise<void>,
    ): void;
    /**
     * Registers a hook to run after update actions.
     */
    afterUpdate<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run after update commits.
     */
    afterUpdateCommit<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run before create or update actions.
     */
    beforeSave(
      cb: (utils: BeforeActionHookUtils<Columns>) => void | Promise<void>,
    ): void;
    /**
     * Registers a hook to run after create or update actions.
     */
    afterSave<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run after create or update commits.
     */
    afterSaveCommit<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run before delete actions.
     */
    beforeDelete(cb: QueryBeforeHook): void;
    /**
     * Registers a hook to run after delete actions.
     */
    afterDelete<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
    /**
     * Registers a hook to run after delete commits.
     */
    afterDeleteCommit<S extends (keyof Columns & string)[]>(
      select: S,
      cb: AfterHook<S, Columns>,
    ): void;
  }

  export type Init<Columns extends ColumnsShape> = (
    orm: unknown,
    hooks: InitHooks<Columns>,
  ) => void;

  export interface DefineTableOptions {
    /**
     * Stable table identity used when resolving relation targets.
     */
    id?: string;
    /**
     * Database table name used when it differs from the query-facing table name.
     */
    nameInDb?: string;
    /**
     * Database schema containing this table.
     */
    schema?: QuerySchema;
    /**
     * Suppress the no-primary-key error for this table.
     */
    noPrimaryKey?: boolean;
    /**
     * Override the table factory snake-case setting for this table.
     */
    snakeCase?: boolean;
    /**
     * Table comment.
     */
    comment?: string;
    /**
     * Exclude this table from generated migration DDL reconciliation.
     */
    generatorIgnore?: boolean;
    /**
     * Auto-create foreign keys for relations of this table.
     */
    autoForeignKeys?: TableData.References.BaseOptions | boolean;
    /**
     * Mark this table as read-only to prevent mutations.
     */
    readOnly?: boolean;
  }

  type DefineTableId<
    Table extends string,
    Options extends DefineTableOptions,
  > = Options extends { id: infer Id extends string } ? Id : Table;

  type DefineTableReadOnly<Options extends DefineTableOptions> =
    Options extends { readOnly: true } ? true : undefined;

  export interface DefineTable<
    SchemaConfig extends ColumnSchemaConfig,
    ColumnTypes,
  > {
    <Table extends string, Columns extends ColumnsShape>(
      table: Table,
      t: (columnTypes: ColumnTypes) => Columns,
    ): OrmTable<
      Table,
      Table,
      Columns,
      undefined,
      ColumnTypes,
      undefined,
      undefined,
      undefined,
      SchemaConfig,
      never,
      undefined
    >;
    <
      Table extends string,
      const Options extends DefineTableOptions,
      Columns extends ColumnsShape,
    >(
      table: Table,
      options: Options,
      t: (columnTypes: ColumnTypes) => Columns,
    ): OrmTable<
      DefineTableId<Table, Options>,
      Table,
      Columns,
      undefined,
      ColumnTypes,
      undefined,
      undefined,
      undefined,
      SchemaConfig,
      never,
      DefineTableReadOnly<Options>
    >;

    /**
     * Creates a table-definition helper with inherited factory options.
     * Options provided here replace the corresponding parent options.
     */
    extend<
      ExtendedSchemaConfig extends ColumnSchemaConfig = SchemaConfig,
      ExtendedColumnTypes = ColumnTypes,
    >(
      options: TableFactoryOptions<ExtendedSchemaConfig, ExtendedColumnTypes>,
    ): DefineTable<ExtendedSchemaConfig, ExtendedColumnTypes>;

    /**
     * Returns the file path where the table factory was defined.
     * Uses stack trace analysis to determine the caller's file path.
     * @throws Error if file path cannot be determined and `filePath` option was not provided to `createTableFactory`
     */
    getFilePath(): string;
    /**
     * Column types configured for this table factory.
     */
    types: ColumnTypes;
    /**
     * Export name configured for this table factory.
     */
    exportAs: string;
    /**
     * Custom timestamp SQL configured for this table factory.
     */
    nowSQL?: string;
    /**
     * Whether this table factory maps columns and table names to snake case.
     */
    snakeCase?: boolean;
    /**
     * Default full text search language configured for this table factory.
     */
    language?: string;
  }

  export interface DefineViewOptions {
    /**
     * Stable view identity used when resolving relation targets.
     * Defaults to the view name when not provided.
     */
    id?: string;
    /**
     * Database schema containing this view.
     */
    schema?: QuerySchema;
    /**
     * Database view name used when it differs from the query-facing view name.
     */
    nameInDb?: string;
    /**
     * Override the table factory snake-case setting for this view.
     */
    snakeCase?: boolean;
    /**
     * Default language for full text search columns in this view.
     */
    language?: string;
    /**
     * Exclude this view from generated migration DDL reconciliation.
     */
    generatorIgnore?: true;
    /**
     * SQL expression that defines this view.
     */
    sql?: string | RawSqlBase;
    /**
     * Set to false to expose mutation methods on a regular view.
     */
    readOnly?: boolean;
    /**
     * Mark this definition as a materialized view.
     */
    materialized?: true;
    /**
     * CREATE MATERIALIZED VIEW WITH DATA / WITH NO DATA option.
     */
    withData?: boolean;
    /**
     * CREATE VIEW RECURSIVE option used by migration generation.
     */
    recursive?: boolean;
    /**
     * CREATE VIEW CHECK OPTION used by migration generation.
     */
    checkOption?: 'LOCAL' | 'CASCADED';
    /**
     * CREATE VIEW security_barrier option used by migration generation.
     */
    securityBarrier?: boolean;
    /**
     * CREATE VIEW security_invoker option used by migration generation.
     */
    securityInvoker?: boolean;
  }

  type DefineViewId<Options, Name extends string> = Options extends {
    id: infer Id extends string;
  }
    ? Id
    : Name;

  type DefineViewReadOnly<Options> = Options extends { readOnly: false }
    ? Options extends { materialized: true }
      ? true
      : false
    : true;

  type DefineViewMaterialized<Options> = Options extends { materialized: true }
    ? true
    : undefined;

  export interface View<
    Id extends string,
    Name extends string,
    Columns extends ColumnsShape,
    ColumnTypes,
    Relations,
    Computed = undefined,
    Scopes extends RecordUnknown | undefined = undefined,
    SoftDelete extends true | string | undefined = undefined,
    ReadOnly extends boolean | undefined = true,
    Materialized extends true | undefined = undefined,
    SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  > {
    data: {
      id: Id;
      table: undefined;
      name: Name;
      relations: Relations;
      columns: Columns;
      types: ColumnTypes;
      computed: Computed;
      scopes: Scopes;
      softDelete: SoftDelete;
      readOnly: ReadOnly;
      materialized: Materialized;
      tableData: TableDataItem[];
    };
    prototype: {
      columns: {
        shape: Columns;
      };
    };
    inputSchema: SchemaConfig['inputSchema'];
    outputSchema: SchemaConfig['outputSchema'];
    querySchema: SchemaConfig['querySchema'];
    pkeySchema: SchemaConfig['pkeySchema'];
    createSchema: SchemaConfig['createSchema'];
    updateSchema: SchemaConfig['updateSchema'];

    <C extends (keyof Columns & string)[]>(
      ...columns: C
    ): OrmTable.Relations.Endpoint<Id, C, ColumnsShape.InputPartial<Columns>>;

    instance(): ORMTableInput;
    nowSQL?: string;

    query(fn: (orm: OrchidORM) => Query): this;

    through<Through extends string>(
      through: Through,
      source: string,
    ): OrmTable.Relations.Through<
      Id,
      Through,
      ColumnsShape.InputPartial<Columns>
    >;

    softDelete(): View<
      Id,
      Name,
      Columns,
      ColumnTypes,
      Relations,
      Computed,
      Scopes,
      true,
      ReadOnly,
      Materialized,
      SchemaConfig
    >;
    softDelete<Column extends keyof Columns & string>(
      column: Column,
    ): View<
      Id,
      Name,
      Columns,
      ColumnTypes,
      Relations,
      Computed,
      Scopes,
      Column,
      ReadOnly,
      Materialized,
      SchemaConfig
    >;

    computed<Fn extends ComputedOptionsFactory<unknown, Columns>>(
      computed: Fn,
    ): View<
      Id,
      Name,
      Columns,
      ColumnTypes,
      Relations,
      Fn,
      Scopes,
      SoftDelete,
      ReadOnly,
      Materialized,
      SchemaConfig
    >;

    scopes<Keys extends string>(
      scopes: DbTableOptionScopes<Name, Columns, Keys>,
    ): View<
      Id,
      Name,
      Columns,
      ColumnTypes,
      Relations,
      Computed,
      DbTableOptionScopes<Name, Columns, Keys>,
      SoftDelete,
      ReadOnly,
      Materialized,
      SchemaConfig
    >;

    grants(grants: readonly Grant.TableClassGrant[]): this;

    init(fn: OrmTable.Init<Columns>): this;

    // oxlint-disable-next-line typescript/no-explicit-any
    relations<Fn extends (self: OrmTable.Relations.Arg<keyof Columns>) => any>(
      fn: Fn,
    ): View<
      Id,
      Name,
      Columns,
      ColumnTypes,
      Fn,
      Computed,
      Scopes,
      SoftDelete,
      ReadOnly,
      Materialized,
      SchemaConfig
    >;
  }

  export interface DefineView<
    SchemaConfig extends ColumnSchemaConfig,
    ColumnTypes,
  > {
    <Name extends string, Columns extends ColumnsShape>(
      name: Name,
      t: (columnTypes: ColumnTypes) => Columns,
    ): View<
      Name,
      Name,
      Columns,
      ColumnTypes,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      SchemaConfig
    >;
    <
      Name extends string,
      const Options extends DefineViewOptions,
      Columns extends ColumnsShape,
    >(
      name: Name,
      options: Options,
      t: (columnTypes: ColumnTypes) => Columns,
    ): View<
      DefineViewId<Options, Name>,
      Name,
      Columns,
      ColumnTypes,
      undefined,
      undefined,
      undefined,
      undefined,
      DefineViewReadOnly<Options>,
      DefineViewMaterialized<Options>,
      SchemaConfig
    >;
  }

  export namespace Relations {
    export type Resolve<Relations> = Relations extends (
      ...args: never[]
    ) => infer Result
      ? ResolveMany<Result>
      : Relations;

    export type ResolveMany<Relations> = {
      [K in keyof Relations]: ResolveOne<Relations[K]>;
    };

    export type ResolveOne<Relation> =
      Relation extends BelongsTo<infer C, infer Fn, infer Required>
        ? ResolvedBelongsTo<TargetId<Fn>, C, TargetReferences<Fn>, Required>
        : Relation extends HasOne<infer C, infer Fn, infer Required>
          ? ResolvedHasOne<TargetId<Fn>, C, TargetReferences<Fn>, Required>
          : Relation extends HasMany<infer C, infer Fn>
            ? ResolvedHasMany<TargetId<Fn>, C, TargetReferences<Fn>>
            : Relation extends HasAndBelongsToMany<
                  infer C,
                  infer Fn,
                  infer Options
                >
              ? ResolveHasAndBelongsToMany<C, Fn, Options>
              : Relation extends HasOneThrough<infer Fn, infer Required>
                ? ResolvedHasOneThrough<
                    TargetId<Fn>,
                    ResolveHasOneThroughOptions<
                      RelationThroughOptions<TargetThrough<Fn>>,
                      Required
                    >
                  >
                : Relation extends HasManyThrough<infer Fn>
                  ? ResolvedHasManyThrough<
                      TargetId<Fn>,
                      RelationThroughOptions<TargetThrough<Fn>>
                    >
                  : Relation;

    export type ResolveHasAndBelongsToMany<
      C extends string[],
      Fn extends Function,
      Options,
      References extends string[] = TargetReferences<Fn>,
    > = ResolvedHasAndBelongsToMany<
      TargetId<Fn>,
      C,
      References,
      ResolveHasAndBelongsToManyOptions<C, References, Options>
    >;

    export type TargetResult<Fn extends Function> =
      Fn extends () => infer Result ? Result : never;

    export type TargetId<Fn extends Function> =
      TargetResult<Fn> extends { id: infer Id extends string }
        ? Id
        : TargetResult<Fn> extends {
              data: { id: infer Id extends string };
            }
          ? Id
          : string;

    export type TargetReferences<Fn extends Function> =
      TargetResult<Fn> extends { columns: infer References extends string[] }
        ? References
        : string[];

    export type TargetThrough<Fn extends Function> =
      TargetResult<Fn> extends { through: infer Through extends string }
        ? Through
        : string;

    export interface Arg<ColumnKeys> {
      <C extends (ColumnKeys & string)[]>(...columns: C): Fns<C>;
      hasOne<Fn extends Function>(fn: Fn): HasOneThrough<Fn>;
      hasMany<Fn extends Function>(fn: Fn): HasManyThrough<Fn>;
    }

    export interface Through<
      Id extends string,
      Through extends string,
      Conditions,
    > {
      id: Id;
      through: Through;
      source: string;
      where<T>(this: T, conditions: Conditions): T;
    }

    export interface Endpoint<Id extends string, C, Conditions> {
      id: Id;
      columns: C;
      where<T>(this: T, conditions: Conditions): T;
      through<Through extends string>(
        through: Through,
        source: string,
      ): OrmTable.Relations.Through<Id, Through, Conditions>;
    }

    export interface Fns<C extends string[]> {
      belongsTo<Fn extends Function>(fn: Fn): BelongsTo<C, Fn>;
      hasOne<Fn extends Function>(fn: Fn): HasOne<C, Fn>;
      hasMany<Fn extends Function>(fn: Fn): HasMany<C, Fn>;
      hasAndBelongsToMany<Fn extends Function>(
        fn: Fn,
      ): HasAndBelongsToMany<C, Fn>;
    }

    export interface LazyRelationRefsOptions<C extends string[]> {
      columns: C;
    }

    export interface LazyRelationRefsOptionsWithRequired<
      C extends string[],
      Required extends boolean,
    > extends LazyRelationRefsOptions<C> {
      required: Required;
    }

    export type LazyRelationRefsOptionsForRequired<
      C extends string[],
      Required extends boolean | undefined,
    > = Required extends boolean
      ? LazyRelationRefsOptionsWithRequired<C, Required>
      : LazyRelationRefsOptions<C>;

    export interface RelationRefsOptions<
      C extends string[],
      References extends string[],
    > extends LazyRelationRefsOptions<C> {
      references: References;
    }

    export interface RelationRefsOptionsWithRequired<
      C extends string[],
      References extends string[],
      Required extends boolean,
    > extends RelationRefsOptions<C, References> {
      required: Required;
    }

    export type RelationRefsOptionsForRequired<
      C extends string[],
      References extends string[],
      Required extends boolean | undefined,
    > = Required extends boolean
      ? RelationRefsOptionsWithRequired<C, References, Required>
      : RelationRefsOptions<C, References>;

    export interface BelongsTo<
      C extends string[],
      Fn extends Function,
      Required extends boolean | undefined = undefined,
    > {
      type: 'belongsTo';
      fn: Fn;
      options: LazyRelationRefsOptionsForRequired<C, Required>;
      __required?: Required;
      required(): BelongsTo<C, Fn, true>;
      required(value: false): BelongsTo<C, Fn, false>;
      /**
       * Controls whether a foreign key constraint is auto-created on the
       * **owning table** (the table this relation is defined on).
       *
       * - `true` (default when autoForeignKeys is enabled) — create FK with DB defaults.
       * - `false` — skip FK creation entirely.
       * - `{ onUpdate: 'CASCADE', onDelete: 'SET NULL' }` — create FK with these options.
       *
       * Only needed when `autoForeignKeys` is enabled on the table config;
       * otherwise no FK is created by default.
       *
       * @example
       * // disable FK for this relation
       * user('Id').belongsTo(() => ProfileTable('UserId')).foreignKey(false)
       *
       * @example
       * // custom FK options
       * user('Id').belongsTo(() => ProfileTable('UserId')).foreignKey({ onDelete: 'CASCADE' })
       */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): BelongsTo<C, Fn, Required>;
    }

    export interface HasOne<
      C extends string[],
      Fn extends Function,
      Required extends boolean | undefined = undefined,
    > {
      type: 'hasOne';
      fn: Fn;
      options: LazyRelationRefsOptionsForRequired<C, Required>;
      __required?: Required;
      required(): HasOne<C, Fn, true>;
      required(value: false): HasOne<C, Fn, false>;
      /**
       * Controls whether a foreign key constraint is auto-created on the
       * **related table** (the table pointed to by this relation).
       *
       * - `true` (default when autoForeignKeys is enabled) — create FK with DB defaults.
       * - `false` — skip FK creation entirely.
       * - `{ onUpdate: 'CASCADE', onDelete: 'SET NULL' }` — create FK with these options.
       *
       * Only needed when `autoForeignKeys` is enabled on the table config;
       * otherwise no FK is created by default.
       *
       * @example
       * // disable FK for this relation
       * user('Id').hasOne(() => ProfileTable('UserId')).foreignKey(false)
       *
       * @example
       * // custom FK options
       * user('Id').hasOne(() => ProfileTable('UserId')).foreignKey({ onDelete: 'CASCADE' })
       */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): HasOne<C, Fn, Required>;
    }

    export interface HasMany<C extends string[], Fn extends Function> {
      type: 'hasMany';
      fn: Fn;
      options: LazyRelationRefsOptions<C>;
      /**
       * Controls whether a foreign key constraint is auto-created on the
       * **related table** (the table pointed to by this relation).
       *
       * - `true` (default when autoForeignKeys is enabled) — create FK with DB defaults.
       * - `false` — skip FK creation entirely.
       * - `{ onUpdate: 'CASCADE', onDelete: 'SET NULL' }` — create FK with these options.
       *
       * Only needed when `autoForeignKeys` is enabled on the table config;
       * otherwise no FK is created by default.
       *
       * @example
       * // disable FK for this relation
       * user('Id').hasMany(() => PostTable('UserId')).foreignKey(false)
       *
       * @example
       * // custom FK options
       * user('Id').hasMany(() => PostTable('UserId')).foreignKey({ onDelete: 'CASCADE' })
       */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): HasMany<C, Fn>;
    }

    export interface HasAndBelongsToManyOptions<C extends string[]> {
      columns: C;
    }

    export interface HasAndBelongsToManyForeignKeyOptions {
      forThisTable?: boolean | TableData.References.BaseOptions;
      forRelatedTable?: boolean | TableData.References.BaseOptions;
      forBothTables?: boolean | TableData.References.BaseOptions;
    }

    export interface LazyHasAndBelongsToManyThroughOptions<
      C extends string[],
    > extends HasAndBelongsToManyOptions<C> {
      references: string[];
      through: {
        // Schema parsed from a schema-qualified join table name.
        schema?: QuerySchema;
        table: string;
        snakeCase?: boolean;
        columns: string[];
        references: string[];
      };
      foreignKeys?: HasAndBelongsToManyForeignKeyOptions;
    }

    export interface HasAndBelongsToManyThroughOptions<
      C extends string[],
      References extends string[],
    > extends HasAndBelongsToManyOptions<C> {
      references: string[];
      through: {
        // Schema parsed from a schema-qualified join table name.
        schema?: QuerySchema;
        table: string;
        snakeCase?: boolean;
        columns: string[];
        references: References;
      };
      foreignKeys?: HasAndBelongsToManyForeignKeyOptions;
    }

    export interface HasAndBelongsToManyThroughConfig {
      /**
       * Database schema containing this join table.
       */
      schema?: QuerySchema;
      /**
       * Set to false to preserve the join table name when the owning table
       * uses snake-case mode.
       */
      joinTableSnakeCase?: boolean;
    }

    export type ResolveHasAndBelongsToManyOptions<
      C extends string[],
      References extends string[],
      Options = HasAndBelongsToManyOptions<C>,
    > =
      Options extends LazyHasAndBelongsToManyThroughOptions<C>
        ? HasAndBelongsToManyThroughOptions<C, References>
        : Options;

    export type ResolveHasOneThroughOptions<
      Options,
      Required extends boolean | undefined,
    > = Required extends boolean ? Options & { required: Required } : Options;

    export interface HasAndBelongsToMany<
      C extends string[],
      Fn extends Function,
      Options = HasAndBelongsToManyOptions<C>,
    > {
      type: 'hasAndBelongsToMany';
      fn: Fn;
      options: Options;
      through(
        joinTable: string,
        selfColumns: string | (string[] & { length: C['length'] }),
        relColumns: string | string[],
        options?: HasAndBelongsToManyThroughConfig,
      ): HasAndBelongsToMany<C, Fn, LazyHasAndBelongsToManyThroughOptions<C>>;
      /**
       * Controls foreign key constraints on the **join table**. Unlike other
       * relation kinds, hasAndBelongsToMany creates FKs on both sides of the
       * join, so this method accepts a richer options object.
       *
       * - `true` (default) — create all join-table FKs with DB defaults.
       * - `false` — skip all join-table FK creation.
       * - `{ forThisTable, forRelatedTable, forBothTables }` — fine-grained control:
       *   - `forThisTable` — FK from join table → **owning table** (this table).
       *   - `forRelatedTable` — FK from join table → **related table**.
       *   - `forBothTables` — shorthand: applies to both FKs at once.
       *
       * Each sub-value can be `false` (skip), `true` (default), or
       * `{ onUpdate: 'CASCADE', onDelete: 'SET NULL' }` (custom options).
       *
       * Must be called **after** `.through()`.
       *
       * @example
       * // disable all join-table FKs
       * post('Id')
       *   .hasAndBelongsToMany(() => TagTable('Id'))
       *   .through('postTag', ['postId'], ['tagId'])
       *   .foreignKey(false)
       *
       * @example
       * // custom FK on both sides
       * post('Id')
       *   .hasAndBelongsToMany(() => TagTable('Id'))
       *   .through('postTag', ['postId'], ['tagId'])
       *   .foreignKey({
       *     forThisTable: { onDelete: 'CASCADE' },
       *     forRelatedTable: { onDelete: 'CASCADE' },
       *   })
       *
       * @example
       * // same custom FK via shorthand
       * post('Id')
       *   .hasAndBelongsToMany(() => TagTable('Id'))
       *   .through('postTag', ['postId'], ['tagId'])
       *   .foreignKey({ forBothTables: { onDelete: 'CASCADE' } })
       */
      foreignKey(
        value?: boolean | HasAndBelongsToManyForeignKeyOptions,
      ): HasAndBelongsToMany<C, Fn, Options>;
    }

    export interface ResolvedBelongsTo<
      Id extends string,
      C extends string[],
      References extends string[],
      Required extends boolean | undefined = undefined,
    > {
      type: 'belongsTo';
      id: Id;
      options: RelationRefsOptionsForRequired<C, References, Required>;
      __required?: Required;
      required(): ResolvedBelongsTo<Id, C, References, true>;
      required(value: false): ResolvedBelongsTo<Id, C, References, false>;
      /** @see BelongsTo.foreignKey */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): ResolvedBelongsTo<Id, C, References, Required>;
    }

    export interface ResolvedHasOne<
      Id extends string,
      C extends string[],
      References extends string[],
      Required extends boolean | undefined = undefined,
    > {
      type: 'hasOne';
      id: Id;
      options: RelationRefsOptionsForRequired<C, References, Required>;
      __required?: Required;
      required(): ResolvedHasOne<Id, C, References, true>;
      required(value: false): ResolvedHasOne<Id, C, References, false>;
      /** @see HasOne.foreignKey */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): ResolvedHasOne<Id, C, References, Required>;
    }

    export interface ResolvedHasMany<
      Id extends string,
      C extends string[],
      References extends string[],
    > {
      type: 'hasMany';
      id: Id;
      options: RelationRefsOptions<C, References>;
      /** @see HasMany.foreignKey */
      foreignKey(
        value?: boolean | TableData.References.BaseOptions,
      ): ResolvedHasMany<Id, C, References>;
    }

    export interface ResolvedHasAndBelongsToMany<
      Id extends string,
      C extends string[],
      References extends string[],
      Options = HasAndBelongsToManyOptions<C>,
    > {
      type: 'hasAndBelongsToMany';
      id: Id;
      options: Options;
      through(
        joinTable: string,
        selfColumns: string | (string[] & { length: C['length'] }),
        relColumns: string | string[],
        options?: HasAndBelongsToManyThroughConfig,
      ): ResolvedHasAndBelongsToMany<
        Id,
        C,
        References,
        HasAndBelongsToManyThroughOptions<C, References>
      >;
    }

    export interface RelationThroughOptions<Through extends string = string> {
      through: Through;
      source: string;
      on?: RecordUnknown;
      required?: boolean;
    }

    export interface HasOneThrough<
      Fn extends Function,
      Required extends boolean | undefined = undefined,
    > {
      type: 'hasOne';
      fn: Fn;
      options: ResolveHasOneThroughOptions<
        RelationThroughOptions<TargetThrough<Fn>>,
        Required
      >;
      __required?: Required;
      required(): HasOneThrough<Fn, true>;
      required(value: false): HasOneThrough<Fn, false>;
    }

    export interface HasManyThrough<Fn extends Function> {
      type: 'hasMany';
      fn: Fn;
      options: RelationThroughOptions<TargetThrough<Fn>>;
    }

    export interface ResolvedHasOneThrough<Id extends string, Options> {
      type: 'hasOne';
      id: Id;
      options: Options;
      __required?: Options extends { required?: infer Required }
        ? Required
        : undefined;
      required(): ResolvedHasOneThrough<Id, Options & { required: true }>;
      required(
        value: false,
      ): ResolvedHasOneThrough<Id, Options & { required: false }>;
    }

    export interface ResolvedHasManyThrough<Id extends string, Options> {
      type: 'hasMany';
      id: Id;
      options: Options;
    }
  }
}

const makeRelationEndpoint = (
  id: string,
  columns: string[],
  on?: RecordUnknown,
  through?: string,
  source?: string,
): OrmTable.RelationEndpointData => {
  const endpoint = {
    id,
    columns,
    on,
    relationThrough: through,
    relationSource: source,
    where(conditions: RecordUnknown) {
      return makeRelationEndpoint(
        id,
        columns,
        { ...on, ...conditions },
        through,
        source,
      );
    },
  } as RecordUnknown;

  if (through) {
    endpoint.through = through;
    endpoint.source = source;
  } else {
    endpoint.through = (through: string, source: string) =>
      makeRelationEndpoint(id, columns, on, through, source);
  }

  return endpoint as never;
};

const getRelationTargetId = (target: unknown): string => {
  const item = target as { id?: string; data?: { id: string } };
  const id = item.id ?? item.data?.id;
  if (!id) {
    throw new Error('Cannot get relation target id');
  }

  return id;
};

const getRelationEndpointOptions = (endpoint: OrmTable.RelationEndpointData) =>
  endpoint.on
    ? { references: endpoint.columns, on: endpoint.on }
    : { references: endpoint.columns };

const getRelationThroughOptions = (endpoint: OrmTable.RelationEndpointData) => {
  const options: RecordUnknown = {
    through: endpoint.relationThrough,
    source: endpoint.relationSource,
  };
  if (endpoint.on) options.on = endpoint.on;

  return options;
};

const makeRelationBuilder = () => {
  const withRequired = (relation: unknown) => {
    const item = relation as {
      options: {
        required?: boolean;
        foreignKey?: boolean | TableData.References.BaseOptions;
      };
      required?: (value?: boolean) => unknown;
      foreignKey?: (
        value?: boolean | TableData.References.BaseOptions,
      ) => unknown;
    };
    item.required = (value = true) => {
      item.options.required = value;
      return item;
    };
    item.foreignKey = (
      value: boolean | TableData.References.BaseOptions = true,
    ) => {
      item.options.foreignKey = value;
      return item;
    };

    return item as never;
  };

  const builder = ((...columns: string[]) => ({
    belongsTo: (fn: () => unknown) => {
      const endpoint = fn() as OrmTable.RelationEndpointData;
      return withRequired({
        type: 'belongsTo',
        id: getRelationTargetId(endpoint),
        options: { columns, ...getRelationEndpointOptions(endpoint) },
      });
    },
    hasOne: (fn: () => unknown) => {
      const endpoint = fn() as OrmTable.RelationEndpointData;
      return withRequired({
        type: 'hasOne',
        id: getRelationTargetId(endpoint),
        options: { columns, ...getRelationEndpointOptions(endpoint) },
      } as never);
    },
    hasMany: (fn: () => unknown) => {
      const endpoint = fn() as OrmTable.RelationEndpointData;
      return withRequired({
        type: 'hasMany',
        id: getRelationTargetId(endpoint),
        options: { columns, ...getRelationEndpointOptions(endpoint) },
      } as never);
    },
    hasAndBelongsToMany: (fn: () => unknown) => {
      const endpoint = fn() as OrmTable.RelationEndpointData;
      const options = { columns } as {
        columns: string[];
        references?: string[];
        on?: RecordUnknown;
        foreignKey?: boolean | TableData.References.Options;
        through?: {
          // Schema parsed from a schema-qualified join table name.
          schema?: QuerySchema;
          table: string;
          snakeCase?: boolean;
          columns: string[];
          references: string[];
          foreignKey?: boolean | TableData.References.Options;
        };
      };
      const relation = {
        type: 'hasAndBelongsToMany',
        id: getRelationTargetId(endpoint),
        options,
        through(
          joinTable: string,
          selfColumns: string | string[],
          relColumns: string | string[],
          throughOptions?: OrmTable.Relations.HasAndBelongsToManyThroughConfig,
        ) {
          this.options.references = Array.isArray(selfColumns)
            ? selfColumns
            : [selfColumns];
          this.options.on = endpoint.on;
          const schemaIndex = joinTable.indexOf('.');
          const parsedSchema =
            schemaIndex === -1 ? undefined : joinTable.slice(0, schemaIndex);
          const table =
            schemaIndex === -1 ? joinTable : joinTable.slice(schemaIndex + 1);
          this.options.through = {
            schema: throughOptions?.schema ?? parsedSchema,
            table,
            snakeCase: throughOptions?.joinTableSnakeCase,
            columns: Array.isArray(relColumns) ? relColumns : [relColumns],
            references: endpoint.columns,
          };

          return this;
        },
        foreignKey(
          value?:
            | boolean
            | {
                forThisTable?: boolean | TableData.References.BaseOptions;
                forRelatedTable?: boolean | TableData.References.BaseOptions;
                forBothTables?: boolean | TableData.References.BaseOptions;
              },
        ) {
          if (value === false) {
            this.options.foreignKey = false;
            if (this.options.through) {
              this.options.through.foreignKey = false;
            }
          } else if (value === undefined || value === true) {
            this.options.foreignKey = true;
            if (this.options.through) {
              this.options.through.foreignKey = true;
            }
          } else if ('forBothTables' in value) {
            this.options.foreignKey = value.forBothTables ?? true;
            if (this.options.through) {
              this.options.through.foreignKey = value.forBothTables ?? true;
            }
          } else {
            this.options.foreignKey = value.forThisTable ?? true;
            if (this.options.through) {
              this.options.through.foreignKey = value.forRelatedTable ?? true;
            }
          }

          return this;
        },
      };

      return relation as never;
    },
  })) as unknown as {
    hasOne(fn: () => unknown): unknown;
    hasMany(fn: () => unknown): unknown;
  };

  builder.hasOne = (fn: () => unknown) => {
    const endpoint = fn() as OrmTable.RelationEndpointData;

    return withRequired({
      type: 'hasOne',
      id: getRelationTargetId(endpoint),
      options: getRelationThroughOptions(endpoint),
    } as never);
  };
  builder.hasMany = (fn: () => unknown) => {
    const endpoint = fn() as OrmTable.RelationEndpointData;

    return {
      type: 'hasMany',
      id: getRelationTargetId(endpoint),
      options: getRelationThroughOptions(endpoint),
    } as never;
  };

  return builder as never;
};

class InitHookTarget extends QueryHooks {
  constructor(public q: QueryData) {
    super();
  }

  clone<T>(this: T): T {
    return this;
  }
}

const setDefinitionSchemaMethods = (
  definition: {
    prototype: {
      columns?: {
        shape: ColumnsShape;
      };
    };
    inputSchema?: unknown;
    outputSchema?: unknown;
    querySchema?: unknown;
    pkeySchema?: unknown;
    createSchema?: unknown;
    updateSchema?: unknown;
  },
  schema: ColumnSchemaConfig,
  shape: ColumnsShape,
) => {
  definition.prototype ??= {};
  definition.prototype.columns = { shape };
  definition.inputSchema = schema.inputSchema;
  definition.outputSchema = schema.outputSchema;
  definition.querySchema = schema.querySchema;
  definition.pkeySchema = schema.pkeySchema;
  definition.createSchema = schema.createSchema;
  definition.updateSchema = schema.updateSchema;
};

export const createTableFactory = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>(
  options?: TableFactoryOptions<SchemaConfig, ColumnTypes>,
): OrmTable.TableFactoryKit<SchemaConfig, ColumnTypes> => {
  const schema = (
    options?.schemaConfig ?? defaultSchemaConfig
  )() as SchemaConfig;
  const defaultColumnTypes = makeColumnTypes(schema);
  const columnTypesOption = options?.columnTypes;
  const columnTypes = (
    typeof columnTypesOption === 'function'
      ? // oxlint-disable-next-line typescript/no-explicit-any
        (columnTypesOption as any)(defaultColumnTypes)
      : columnTypesOption || defaultColumnTypes
  ) as ColumnTypes;

  const defineTableExportAs = options?.defineTableExportAs ?? 'defineTable';

  // stack is needed only if filePath wasn't given
  const filePathOrStack = options?.filePath || getStackTrace();

  let filePath: string | undefined;

  const defineTable = ((
    table: string,
    optionsOrT:
      | OrmTable.DefineTableOptions
      | ((columnTypes: ColumnTypes) => ColumnsShape),
    maybeT?: (columnTypes: ColumnTypes) => ColumnsShape,
  ) => {
    const tableOptions =
      typeof optionsOrT === 'function' ? undefined : optionsOrT;
    const t = typeof optionsOrT === 'function' ? optionsOrT : maybeT;
    if (!t) throw new Error('Column definitions are required');

    const id = tableOptions?.id ?? table;
    const shape = getColumnTypes(
      columnTypes,
      t,
      options?.nowSQL,
      options?.language,
    );
    const tableData: TableData = {};

    const snakeCase = tableOptions?.snakeCase ?? options?.snakeCase;

    if (snakeCase) {
      for (const key in shape) {
        const column = shape[key];
        if (column.data.name) continue;

        const snakeName = toSnakeCase(key);
        if (snakeName !== key) {
          column.data.name = snakeName;
        }
      }
    }

    const nameInDb =
      tableOptions?.nameInDb ?? (snakeCase ? toSnakeCase(table) : table);

    const autoForeignKeys =
      tableOptions?.autoForeignKeys !== undefined
        ? tableOptions.autoForeignKeys
        : options?.autoForeignKeys;

    const instance: ORMTableInput & {
      q: QueryData;
      relations?: unknown;
      init?(orm: unknown): void;
    } = {
      id,
      table,
      nameInDb,
      schema: tableOptions?.schema ?? options?.schema,
      noPrimaryKey: tableOptions?.noPrimaryKey ?? options?.noPrimaryKey,
      snakeCase,
      comment: tableOptions?.comment,
      generatorIgnore:
        tableOptions?.generatorIgnore ?? options?.generatorIgnore,
      readOnly: tableOptions?.readOnly,
      columns: {
        shape,
        data: tableData as never,
      },
      types: columnTypes,
      filePath: options?.filePath ?? '',
      language: options?.language,
      autoForeignKeys:
        autoForeignKeys === true ? {} : autoForeignKeys || undefined,
      q: {} as QueryData,
    };

    const definition = ((...columns: string[]) =>
      makeRelationEndpoint(id, columns)) as unknown as OrmTable<
      typeof id,
      typeof table,
      ReturnType<typeof t>,
      undefined,
      typeof columnTypes,
      undefined,
      undefined,
      undefined,
      typeof schema,
      never,
      typeof tableOptions extends { readOnly: true } ? true : undefined
    >;

    definition.data = {
      id,
      table,
      name: undefined,
      relations: undefined,
      columns: shape as ReturnType<typeof t>,
      types: undefined,
      computed: undefined,
      scopes: undefined,
      readOnly: tableOptions?.readOnly,
      tableData: tableData as never,
    } as never;
    setDefinitionSchemaMethods(definition, schema, shape);

    definition.exportAs = defineTableExportAs;
    definition.nowSQL = options?.nowSQL;

    definition.instance = () => {
      const { computed, relations, scopes, softDelete, readOnly } =
        definition.data as RecordUnknown;
      instance.computed = computed as never;
      instance.scopes = scopes as never;
      (instance as { softDelete: unknown }).softDelete = softDelete;
      (instance as { readOnly: unknown }).readOnly = readOnly;
      instance.relations =
        typeof relations === 'function'
          ? (relations as (arg: never) => unknown)(makeRelationBuilder())
          : relations;

      return instance as never;
    };
    definition.where = function (conditions: RecordUnknown) {
      return makeRelationEndpoint(id, [], conditions);
    } as never;
    definition.through = (through, source) =>
      makeRelationEndpoint(id, [], undefined, through, source) as never;
    definition.primaryKey = (...args) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).primaryKey(...args) as never,
      );
      return definition as never;
    };
    definition.index = (...args) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).index(...args) as never,
      );
      return definition as never;
    };
    definition.searchIndex = (...args) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).searchIndex(...args) as never,
      );
      return definition as never;
    };
    definition.unique = (...args) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).unique(...args) as never,
      );
      return definition as never;
    };
    definition.exclude = (...args) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).exclude(...args) as never,
      );
      return definition as never;
    };
    definition.check = (...args) => {
      parseTableDataInput(tableData, tableDataMethods.check(...args) as never);
      return definition as never;
    };
    definition.softDelete = (column?: string) => {
      (definition.data as RecordUnknown).softDelete = column || true;
      return definition as never;
    };
    definition.computed = (computed) => {
      (definition.data as RecordUnknown).computed = computed;
      return definition as never;
    };
    definition.scopes = (scopes) => {
      (definition.data as RecordUnknown).scopes = scopes;
      return definition as never;
    };
    definition.grants = (grants) => {
      instance.grants = grants as never;
      return definition as never;
    };
    definition.rls = (rls) => {
      instance.rls = rls as never;
      return definition as never;
    };
    definition.init = (fn) => {
      instance.init = function (
        this: ORMTableInput & { q: QueryData },
        orm: unknown,
      ) {
        fn(orm, new InitHookTarget(this.q));
      };
      return definition as never;
    };
    definition.foreignKey = (
      columns: [string, ...string[]],
      fnOrTable: (() => unknown) | string,
      foreignColumns: [string, ...string[]],
      options?: TableData.References.Options,
    ) => {
      parseTableDataInput(
        tableData,
        // oxlint-disable-next-line typescript/no-explicit-any
        (tableDataMethods as any).foreignKey(
          columns,
          fnOrTable,
          foreignColumns,
          options,
        ) as never,
      );
      return definition as never;
    };
    definition.relations = (fn) => {
      (definition.data as RecordUnknown).relations = fn;
      return definition as never;
    };

    return definition;
  }) as OrmTable.DefineTable<SchemaConfig, ColumnTypes>;

  defineTable.getFilePath = (): string => {
    if (filePath) return filePath;
    if (typeof filePathOrStack === 'string') {
      return (filePath = filePathOrStack);
    }

    filePath = getCallerFilePath(filePathOrStack);
    if (filePath) return filePath;

    throw new Error(
      'Failed to determine file path of a table factory. Please set the `filePath` option of `createTableFactory` manually.',
    );
  };
  defineTable.types = columnTypes;
  defineTable.exportAs = defineTableExportAs;
  defineTable.nowSQL = options?.nowSQL;
  defineTable.snakeCase = options?.snakeCase;
  defineTable.language = options?.language;
  defineTable.extend = <
    ExtendedSchemaConfig extends ColumnSchemaConfig,
    ExtendedColumnTypes,
  >(
    extendedOptions: TableFactoryOptions<
      ExtendedSchemaConfig,
      ExtendedColumnTypes
    >,
  ) =>
    createTableFactory<ExtendedSchemaConfig, ExtendedColumnTypes>({
      ...options,
      ...extendedOptions,
    } as TableFactoryOptions<ExtendedSchemaConfig, ExtendedColumnTypes>)
      .defineTable;

  const defineView = ((
    name: string,
    optionsOrT:
      | OrmTable.DefineViewOptions
      | ((columnTypes: ColumnTypes) => ColumnsShape),
    maybeT?: (columnTypes: ColumnTypes) => ColumnsShape,
  ) => {
    const viewOptions =
      typeof optionsOrT === 'function' ? undefined : optionsOrT;
    const materialized = viewOptions?.materialized;
    const readOnly = (materialized || viewOptions?.readOnly !== false) as
      | false
      | true;
    const t = typeof optionsOrT === 'function' ? optionsOrT : maybeT;
    if (!t) throw new Error('Column definitions are required');

    const language = viewOptions?.language ?? options?.language;
    const snakeCase = viewOptions?.snakeCase ?? options?.snakeCase;
    const shape = getColumnTypes(columnTypes, t, options?.nowSQL, language);
    const tableData: TableData = {};
    const nameInDb =
      viewOptions?.nameInDb ?? (snakeCase ? toSnakeCase(name) : name);

    if (snakeCase) {
      for (const key in shape) {
        const column = shape[key];
        if (column.data.name) continue;

        const snakeName = toSnakeCase(key);
        if (snakeName !== key) {
          column.data.name = snakeName;
        }
      }
    }

    const instance: ORMTableInput & {
      name: string;
      q: QueryData;
      relations?: unknown;
      init?(orm: unknown): void;
    } = {
      id: viewOptions?.id ?? name,
      name,
      nameInDb,
      schema: viewOptions?.schema,
      snakeCase,
      columns: {
        shape,
        data: tableData as never,
      },
      types: columnTypes,
      filePath: options?.filePath ?? '',
      language,
      readOnly,
      materialized,
      generatorIgnore: viewOptions?.generatorIgnore,
      withData: viewOptions?.withData,
      sql: viewOptions?.sql,
      recursive: viewOptions?.recursive,
      checkOption: viewOptions?.checkOption,
      securityBarrier: viewOptions?.securityBarrier,
      securityInvoker: viewOptions?.securityInvoker,
      q: {} as QueryData,
    };

    const viewId = viewOptions?.id ?? name;
    const definition = ((...columns: string[]) =>
      makeRelationEndpoint(viewId, columns)) as unknown as OrmTable.View<
      typeof name,
      typeof name,
      ReturnType<typeof t>,
      unknown,
      undefined,
      undefined,
      undefined,
      undefined,
      typeof readOnly,
      typeof materialized
    >;

    definition.data = {
      id: viewOptions?.id ?? name,
      table: undefined,
      name,
      relations: undefined,
      columns: shape as ReturnType<typeof t>,
      types: undefined,
      computed: undefined,
      scopes: undefined,
      readOnly: readOnly as never,
      materialized: materialized as never,
      tableData: tableData as never,
    } as never;
    setDefinitionSchemaMethods(definition, schema, shape);
    definition.nowSQL = options?.nowSQL;

    // `instance` intentionally exposes the broad runtime input type while
    // static metadata keeps precise table data types.
    definition.instance = () => {
      const { computed, relations, scopes, softDelete } =
        definition.data as RecordUnknown;
      instance.computed = computed as never;
      instance.scopes = scopes as never;
      (instance as { softDelete?: unknown }).softDelete = softDelete;
      instance.relations =
        typeof relations === 'function'
          ? (relations as (arg: never) => unknown)(makeRelationBuilder())
          : relations;

      return instance as never;
    };
    definition.query = (fn) => {
      instance.init = (orm) => {
        instance.query = fn(orm as never) as never;
      };
      return definition;
    };
    definition.through = (through, source) =>
      makeRelationEndpoint(viewId, [], undefined, through, source) as never;
    definition.softDelete = (column?: string) => {
      (definition.data as RecordUnknown).softDelete = column || true;
      return definition as never;
    };
    definition.computed = (computed) => {
      (definition.data as RecordUnknown).computed = computed;
      return definition as never;
    };
    definition.scopes = (scopes) => {
      (definition.data as RecordUnknown).scopes = scopes;
      return definition as never;
    };
    definition.grants = (grants) => {
      instance.grants = grants as never;
      return definition as never;
    };
    definition.init = (fn) => {
      instance.init = function (
        this: ORMTableInput & { q: QueryData },
        orm: unknown,
      ) {
        fn(orm, new InitHookTarget(this.q));
      };
      return definition as never;
    };
    definition.relations = (fn) => {
      (definition.data as RecordUnknown).relations = fn;
      return definition as never;
    };

    return definition as never;
  }) as OrmTable.DefineView<SchemaConfig, ColumnTypes>;

  return {
    defineTable,
    defineView,
    sql: _createDbSqlMethod(columnTypes),
    exportAs: defineTableExportAs,
  };
};
