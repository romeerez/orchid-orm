import { ORMTableInput } from '../orm-table/legacy-table';
import { Query } from 'pqb';
import { CreateData, CreateMethodsNames, DeleteMethodsNames, SelectableFromShape, UpdateData, WhereArg, TableData, RelationConfigBase, ColumnsShape, Column, QueryHasWhere } from 'pqb/internal';
import { RelationConfigSelf, RelationData, RelationThunkBase, RelationToOneDataForCreateSameQuery } from './relations';
export interface BelongsTo extends RelationThunkBase {
    type: 'belongsTo';
    options: BelongsToOptions;
}
export interface BelongsToOptions<Columns extends Column.Shape.QueryInit = Column.Shape.QueryInit, Related extends ORMTableInput = ORMTableInput> {
    required?: boolean;
    columns: (keyof Columns)[];
    references: (keyof Related['columns']['shape'])[];
    foreignKey?: boolean | TableData.References.Options;
    on?: ColumnsShape.InputPartial<Related['columns']['shape']>;
}
export type BelongsToParams<T extends RelationConfigSelf, FK extends string> = {
    [Name in FK]: T['columns']['shape'][Name]['__type'];
};
export type BelongsToDefaultRequired<T extends RelationConfigSelf, Rel extends BelongsTo, Related> = Related extends {
    softDelete: true;
} ? false : BelongsToDefaultRequiredFromColumns<T, Rel>;
type BelongsToDefaultRequiredFromColumns<T extends RelationConfigSelf, Rel extends BelongsTo> = BelongsToColumnRequired<T['columns']['shape'][Rel['options']['columns'][number] & string]> extends true ? true : false;
type BelongsToColumnRequired<Column> = Column extends {
    data: {
        isNullable: true;
    };
} ? false : true;
export type BelongsToQuery<T extends Query, Name extends string> = {
    [P in keyof T]: P extends '__selectable' ? SelectableFromShape<T['shape'], Name> : P extends '__as' ? Name : P extends CreateMethodsNames | DeleteMethodsNames ? never : T[P];
} & QueryHasWhere;
export interface BelongsToDataForCreate<Name extends string, FK extends string, Required, Q extends Query> {
    columns: FK;
    nested: Q extends Query.Pick.IsNotReadOnly ? Required extends true ? {
        [Key in Name]: RelationToOneDataForCreateSameQuery<Q>;
    } : {
        [Key in Name]?: RelationToOneDataForCreateSameQuery<Q>;
    } : {
        [Key in Name]?: never;
    };
}
export interface BelongsToInfo<T extends RelationConfigSelf, FK extends string, Required, Q extends Query> extends RelationConfigBase {
    returnsOne: true;
    required: Required;
    query: Q;
    params: BelongsToParams<T, FK>;
    omitForeignKeyInCreate: FK;
    dataForUpdate: {
        disconnect: boolean;
    } | {
        set: WhereArg<Q>;
    } | (Q extends Query.Pick.IsNotReadOnly ? {
        delete: boolean;
    } | {
        update: UpdateData<Q>;
    } | {
        create: CreateData<Q>;
    } : never);
    dataForUpdateOne: {
        disconnect: boolean;
    } | {
        set: WhereArg<Q>;
    } | (Q extends Query.Pick.IsNotReadOnly ? {
        delete: boolean;
    } | {
        update: UpdateData<Q>;
    } | {
        create: CreateData<Q>;
    } | {
        upsert: {
            update: UpdateData<Q>;
            create: CreateData<Q> | (() => CreateData<Q>);
        };
    } : never);
}
export declare const getBelongsToRequired: (tableConfig: ORMTableInput, relatedTableConfig: ORMTableInput, relation: BelongsTo) => boolean;
export declare const makeBelongsToMethod: (tableConfig: ORMTableInput, table: Query, relation: BelongsTo, relationName: string, query: Query) => RelationData;
export {};
