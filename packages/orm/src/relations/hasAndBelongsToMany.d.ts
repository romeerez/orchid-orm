import { RelationConfigSelf, RelationData, RelationThunkBase } from './relations';
import { Query } from 'pqb';
import { ORMTableInput } from '../orm-table/legacy-table';
import { CreateData, SelectableFromShape, TableData, UpdateData, WhereArg, ColumnsShape, MaybeArray, RelationConfigBase, Column, QueryHasWhere, QuerySchema } from 'pqb/internal';
export interface HasAndBelongsToMany extends RelationThunkBase {
    type: 'hasAndBelongsToMany';
    options: HasAndBelongsToManyOptions;
}
export interface HasAndBelongsToManyOptions<Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit, Related extends ORMTableInput = ORMTableInput> {
    required?: boolean;
    columns: (keyof Columns)[];
    references: string[];
    foreignKey?: boolean | TableData.References.Options;
    through: {
        schema?: QuerySchema;
        table: string;
        snakeCase?: boolean;
        columns: string[];
        references: (keyof Related['columns']['shape'])[];
        foreignKey?: boolean | TableData.References.Options;
    };
    on?: ColumnsShape.InputPartial<Related['columns']['shape']>;
}
export type HasAndBelongsToManyParams<T extends RelationConfigSelf, FK extends string> = {
    [Name in FK]: T['columns']['shape'][Name]['__type'];
};
export type HasAndBelongsToManyQuery<Name extends string, TableQuery extends Query> = {
    [K in keyof TableQuery]: K extends '__selectable' ? SelectableFromShape<TableQuery['shape'], Name> : K extends '__as' ? Name : TableQuery[K];
} & QueryHasWhere;
export interface HasAndBelongsToManyInfo<T extends RelationConfigSelf, Name extends string, FK extends string, Q extends Query> extends RelationConfigBase {
    returnsOne: false;
    query: Q;
    params: HasAndBelongsToManyParams<T, FK>;
    omitForeignKeyInCreate: never;
    dataForCreate: {
        [K in Name]?: Q extends Query.Pick.IsNotReadOnly ? {
            create?: CreateData<Q>[];
            connect?: WhereArg<Q>[];
            connectOrCreate?: {
                where: WhereArg<Q>;
                create: CreateData<Q>;
            }[];
        } : {
            connect?: WhereArg<Q>[];
        };
    };
    dataForUpdate: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
            where: MaybeArray<WhereArg<Q>>;
            data: UpdateData<Q>;
        };
        create?: CreateData<Q>[];
    } : {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
    };
    dataForUpdateOne: Q extends Query.Pick.IsNotReadOnly ? {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
        delete?: MaybeArray<WhereArg<Q>>;
        update?: {
            where: MaybeArray<WhereArg<Q>>;
            data: UpdateData<Q>;
        };
        create?: CreateData<Q>[];
        upsert?: {
            findBy: Q['internal']['uniqueColumns'];
            update: UpdateData<Q>;
            create?: CreateData<Q> | (() => CreateData<Q>);
        };
    } : {
        disconnect?: MaybeArray<WhereArg<Q>>;
        set?: MaybeArray<WhereArg<Q>>;
        add?: MaybeArray<WhereArg<Q>>;
    };
}
export declare const makeHasAndBelongsToManyMethod: (tableConfig: ORMTableInput, table: Query, qb: Query, relation: HasAndBelongsToMany, relationName: string, query: Query, schema?: QuerySchema) => RelationData;
