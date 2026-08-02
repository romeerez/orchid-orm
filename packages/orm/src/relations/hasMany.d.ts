import { RelationData, RelationThunkBase, RelationConfigSelf } from './relations';
import { Query } from 'pqb';
import { CreateData, WhereArg, UpdateData, SelectableFromShape, MaybeArray, RecordUnknown, RelationConfigBase, QueryHasWhere } from 'pqb/internal';
import { NestedInsertManyItems, NestedUpdateManyItems } from './common/utils';
import { RelationRefsOptions, RelationThroughOptions } from './common/options';
import { HasOneOptions, HasOneParams, HasOneQueryThrough } from './hasOne';
import { ORMTableInput } from '../orm-table/legacy-table';
export interface HasMany extends RelationThunkBase {
    type: 'hasMany';
    options: HasOneOptions;
}
export type HasManyQuery<T extends RelationConfigSelf, Name extends string, TableQuery extends Query> = T['relations'][Name]['options'] extends RelationRefsOptions ? {
    [K in keyof TableQuery]: K extends '__defaults' ? {
        [K in keyof TableQuery['__defaults'] | T['relations'][Name]['options']['references'][number]]: true;
    } : K extends '__selectable' ? SelectableFromShape<TableQuery['shape'], Name> : K extends '__as' ? Name : TableQuery[K];
} & QueryHasWhere : HasOneQueryThrough<Name, TableQuery>;
export interface HasManyInfo<T extends RelationConfigSelf, Name extends string, Rel extends HasMany, Q extends Query> extends RelationConfigBase {
    returnsOne: false;
    query: Q;
    params: HasOneParams<T, Rel['options']>;
    omitForeignKeyInCreate: never;
    dataForCreate: {
        [K in Name]?: Q extends Query.Pick.IsNotReadOnly ? Rel['options'] extends RelationThroughOptions ? never : {
            create?: CreateData<Q>[];
            connect?: WhereArg<Q>[];
            connectOrCreate?: {
                where: WhereArg<Q>;
                create: CreateData<Q>;
            }[];
        } : never;
    };
    dataForUpdate: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
            where: MaybeArray<WhereArg<Q>>;
            data: UpdateData<Q>;
        };
    } : never;
    dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
            where: MaybeArray<WhereArg<Q>>;
            data: UpdateData<Q>;
        };
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        create?: CreateData<Q>[];
        upsert?: {
            findBy: Q['internal']['uniqueColumns'];
            update: UpdateData<Q>;
            create?: CreateData<Q> | (() => CreateData<Q>);
        };
    } : never;
}
export type HasManyNestedUpdate = (query: Query, data: RecordUnknown[], relationData: NestedUpdateManyItems) => Promise<void>;
export type HasManyNestedInsert = (query: Query, data: [selfData: RecordUnknown, relationData: NestedInsertManyItems][]) => Promise<void>;
export declare const makeHasManyMethod: (tableConfig: ORMTableInput, table: Query, relation: HasMany, relationName: string, query: Query) => RelationData;
