import { BelongsTo, BelongsToParams } from './belongsTo';
import { HasOne, HasOneParams } from './hasOne';
import { TableQueryBuilder, ORMTableInput } from '../orm-table/legacy-table';
import { CreateData, VirtualColumn, WhereArg, ColumnSchemaConfig, RecordUnknown, RelationJoinQuery, Column, QuerySchema, CreateSelf, PickQuerySelectableRelations, RelationConfigBase } from 'pqb/internal';
import { HasMany } from './hasMany';
import { HasAndBelongsToMany, HasAndBelongsToManyParams } from './hasAndBelongsToMany';
import { Query } from 'pqb';
import { OrmTableThunks, TableInstance } from '../orm';
export type RelationToOneDataForCreate<Rel extends {
    nestedCreateQuery: unknown;
    table: Query;
}> = {
    create: Rel['nestedCreateQuery'];
    connect?: never;
    connectOrCreate?: never;
} | {
    create?: never;
    connect: WhereArg<Rel['table']>;
    connectOrCreate?: never;
} | {
    create?: never;
    connect?: never;
    connectOrCreate: {
        where: WhereArg<Rel['table']>;
        create: Rel['nestedCreateQuery'];
    };
};
interface RelationToOneDataForCreateSameQuerySelf extends CreateSelf, PickQuerySelectableRelations {
}
export type RelationToOneDataForCreateSameQuery<Q extends RelationToOneDataForCreateSameQuerySelf> = {
    create: CreateData<Q>;
    connect?: never;
    connectOrCreate?: never;
} | {
    create?: never;
    connect: WhereArg<Q>;
    connectOrCreate?: never;
} | {
    create?: never;
    connect?: never;
    connectOrCreate: {
        where: WhereArg<Q>;
        create: CreateData<Q>;
    };
};
export interface RelationThunkBase {
    type: string;
    id: string;
    options: unknown;
}
export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;
export interface RelationThunks {
    [K: string]: RelationThunk;
}
export interface RelationData {
    returns: 'one' | 'many';
    queryRelated(params: RecordUnknown): Query;
    virtualColumn?: VirtualColumn<ColumnSchemaConfig>;
    joinQuery: RelationJoinQuery;
    reverseJoin: RelationJoinQuery;
    modifyRelatedQuery?: RelationConfigBase['modifyRelatedQuery'];
}
type TableInstances<T extends OrmTableThunks> = {
    [K in keyof T]: TableInstance<T[K]>;
};
type TableClassInstances<T extends OrmTableThunks> = TableInstances<T>[keyof T];
type RelationToTableInputById<Tables, Id extends string> = Tables extends {
    id: Id;
} ? Tables : never;
type RelationToTableInputByName<T extends OrmTableThunks, Id extends string> = {
    [K in keyof TableInstances<T>]: TableInstances<T>[K] extends {
        table: Id;
    } | {
        name: Id;
    } ? TableInstances<T>[K] : never;
}[keyof T];
type RelationToTableInputFromClasses<T extends OrmTableThunks, Id extends string> = RelationToTableInputById<TableClassInstances<T>, Id> extends infer Result ? [Result] extends [never] ? RelationToTableInputByName<T, Id> : Result : never;
export type RelationToTableInput<TT extends OrmTableThunks, VT extends OrmTableThunks, Rel extends RelationThunkBase> = RelationToTableInputFromClasses<TT, Rel['id']> extends infer Result ? [Result] extends [never] ? RelationToTableInputFromClasses<VT, Rel['id']> extends infer Result ? [Result] extends [never] ? false : Result : never : Result : never;
export type RelationTableToQuery<TT extends OrmTableThunks, VT extends OrmTableThunks, Rel extends RelationThunkBase> = RelationToTableInput<TT, VT, Rel> extends infer Result extends ORMTableInput ? TableQueryBuilder<TT, VT, Result> : never;
export interface RelationConfigSelf {
    columns: {
        shape: Column.Shape.QueryInit;
    };
    relations: RelationThunks;
}
export type RelationConfigParams<T extends RelationConfigSelf, Relation extends RelationThunk> = Relation extends BelongsTo ? BelongsToParams<T, Relation['options']['columns'][number] & string> : Relation extends HasOne | HasMany ? HasOneParams<T, Relation['options']> : Relation extends HasAndBelongsToMany ? HasAndBelongsToManyParams<T, Relation['options']['columns'][number] & string> : never;
export declare const applyRelations: (qb: Query, tables: Record<string, ORMTableInput>, result: {
    [K: string]: Query;
}, schema?: QuerySchema) => void;
export {};
