import { Query } from 'pqb';
import { Column } from 'pqb/internal';
import { CreateData, CreateManyMethodsNames, CreateMethodsNames, EmptyObject, QueryHasWhere, RecordUnknown, RelationConfigBase, SelectableFromShape, UpdateData, WhereArg } from 'pqb/internal';
import { ORMTableInput } from '../orm-table/legacy-table';
import { RelationData, RelationThunkBase, RelationToOneDataForCreate, RelationConfigParams, RelationConfigSelf } from './relations';
import { NestedInsertOneItem, NestedUpdateOneItem } from './common/utils';
import { RelationRefsOptions, RelationThroughOptions } from './common/options';
export interface HasOne extends RelationThunkBase {
    type: 'hasOne';
    options: HasOneOptions;
}
interface RelationHasOneThroughOptions<Through extends string> extends RelationThroughOptions<Through> {
    required?: boolean;
}
export type HasOneOptions<Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit, Related extends ORMTableInput = ORMTableInput, Through extends string = string> = RelationRefsOptions<keyof Columns, Related['columns']['shape']> | RelationHasOneThroughOptions<Through>;
export type HasOneParams<T extends RelationConfigSelf, Options> = Options extends RelationRefsOptions ? {
    [Name in Options['columns'][number]]: T['columns']['shape'][Name]['__type'];
} : Options extends RelationThroughOptions ? RelationConfigParams<T, T['relations'][Options['through']]> : never;
export type HasOneQueryThrough<Name extends string, TableQuery extends Query> = {
    [K in keyof TableQuery]: K extends '__selectable' ? SelectableFromShape<TableQuery['shape'], Name> : K extends '__as' ? Name : K extends CreateMethodsNames ? never : TableQuery[K];
} & QueryHasWhere;
export type HasOneQuery<T extends RelationConfigSelf, Name extends string, TableQuery extends Query> = T['relations'][Name]['options'] extends RelationRefsOptions ? {
    [K in keyof TableQuery]: K extends '__defaults' ? {
        [K in keyof TableQuery['__defaults'] | T['relations'][Name]['options']['references'][number]]: true;
    } : K extends '__selectable' ? SelectableFromShape<TableQuery['shape'], Name> : K extends '__as' ? Name : K extends CreateManyMethodsNames ? never : TableQuery[K];
} & QueryHasWhere : HasOneQueryThrough<Name, TableQuery>;
export interface HasOneInfo<T extends RelationConfigSelf, Name extends string, Rel extends HasOne, Q extends Query> extends RelationConfigBase {
    returnsOne: true;
    required: Rel['options']['required'];
    query: Q;
    params: HasOneParams<T, Rel['options']>;
    omitForeignKeyInCreate: never;
    dataForCreate: {
        [K in Name]?: Q extends Query.Pick.IsNotReadOnly ? Rel['options'] extends RelationThroughOptions ? EmptyObject : RelationToOneDataForCreate<{
            nestedCreateQuery: CreateData<Q>;
            table: Q;
        }> : never;
    };
    dataForUpdate: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect: boolean;
    } | {
        delete: boolean;
    } | {
        update: UpdateData<Q>;
    } : never;
    dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect: boolean;
    } | {
        set: WhereArg<Q>;
    } | {
        delete: boolean;
    } | {
        update: UpdateData<Q>;
    } | {
        upsert: {
            update: UpdateData<Q>;
            create: CreateData<Q> | (() => CreateData<Q>);
        };
    } | {
        create: CreateData<Q>;
    } : never;
}
export type HasOneNestedInsert = (query: Query, data: [selfData: RecordUnknown, relationData: NestedInsertOneItem][]) => Promise<void>;
export type HasOneNestedUpdate = (query: Query, data: RecordUnknown[], relationData: NestedUpdateOneItem) => Promise<void>;
export declare const makeHasOneMethod: (tableConfig: ORMTableInput, table: Query, relation: HasOne, relationName: string, query: Query) => RelationData;
export {};
