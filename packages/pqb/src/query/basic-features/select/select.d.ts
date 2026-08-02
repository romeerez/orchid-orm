import { IsQuery, IsSubQuery, QueryReturnType } from '../../query';
import { Column } from '../../../columns/column';
import { EmptyObject, UnionToIntersection } from '../../../utils';
import { PickQueryDefaultSelect, PickQueryHasSelect, PickQueryRelations, PickQueryRelationsWithData, PickQueryResult, PickQueryReturnType, PickQuerySelectable, PickQueryShape, PickQueryWithData } from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { ColumnsShape } from '../../../columns/columns-shape';
import { QueryThenByReturnType } from '../../then/then';
import { RelationQueryMaybeSingle } from '../../relations';
export interface SelectSelf extends PickQuerySelectable, PickQueryHasSelect, PickQueryDefaultSelect, PickQueryShape, PickQueryRelations, PickQueryResult, PickQueryReturnType, PickQueryWithData {
}
export type SelectArg<T extends SelectSelf> = '*' | keyof T['__selectable'];
export type SelectArgs<T extends SelectSelf> = ('*' | keyof T['__selectable'])[];
interface SubQueryAddition<T extends PickQueryWithData> extends IsSubQuery {
    withData: T['withData'];
}
export type SelectAsFnArg<T extends PickQueryRelationsWithData> = EmptyObject extends T['relations'] ? T : {
    [K in keyof T['relations'] | keyof T]: K extends keyof T['relations'] ? RelationQueryMaybeSingle<T['relations'][K]> & SubQueryAddition<T> : K extends keyof T ? T[K] : never;
};
export interface SelectAsArg<T extends SelectSelf> {
    [K: string]: keyof T['__selectable'] | Expression | ((q: SelectAsFnArg<T>) => unknown);
}
type SelectAsFnReturnType = {
    result: Column.QueryColumns;
    returnType: Exclude<QueryReturnType, 'rows'>;
} | Expression;
interface SelectAsCheckReturnTypes {
    [K: string]: PropertyKey | Expression | ((q: never) => SelectAsFnReturnType);
}
type SelectReturnType<T extends PickQueryReturnType> = T['returnType'] extends 'valueOrThrow' ? 'oneOrThrow' : T extends 'value' ? 'one' : T['returnType'] extends 'pluck' ? 'all' : T['returnType'];
type SelectResult<T extends SelectSelf, Columns extends PropertyKey[]> = {
    [K in keyof T]: K extends '__hasSelect' ? true : K extends 'result' ? {
        [K in '*' extends Columns[number] ? Exclude<Columns[number], '*'> | T['__defaultSelect'] : Columns[number] as T['__selectable'][K]['as']]: T['__selectable'][K]['column'];
    } & (T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? Omit<T['result'], Columns[number]> : unknown) : K extends 'returnType' ? SelectReturnType<T> : K extends 'then' ? QueryThenByReturnType<SelectReturnType<T>, {
        [K in '*' extends Columns[number] ? Exclude<Columns[number], '*'> | T['__defaultSelect'] : Columns[number] as T['__selectable'][K]['as']]: T['__selectable'][K]['column'];
    } & (T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? Omit<T['result'], Columns[number]> : unknown)> : T[K];
};
type SelectResultObj<T extends SelectSelf, Obj> = Obj extends SelectAsCheckReturnTypes ? {
    [K in keyof T]: K extends '__hasSelect' ? true : K extends '__selectable' ? T['__selectable'] & SelectAsSelectable<Obj> : K extends 'result' ? {
        [K in T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? keyof Obj | keyof T['result'] : keyof Obj]: K extends keyof Obj ? SelectAsValueResult<T, Obj[K]> : K extends keyof T['result'] ? T['result'][K] : never;
    } : K extends 'returnType' ? SelectReturnType<T> : K extends 'then' ? QueryThenByReturnType<SelectReturnType<T>, {
        [K in T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? keyof Obj | keyof T['result'] : keyof Obj]: K extends keyof Obj ? SelectAsValueResult<T, Obj[K]> : K extends keyof T['result'] ? T['result'][K] : never;
    }> : T[K];
} : `Invalid return type of ${{
    [K in keyof Obj]: Obj[K] extends (...args: any[]) => any ? ReturnType<Obj[K]> extends SelectAsFnReturnType ? never : K : never;
}[keyof Obj] & string}`;
type SelectResultColumnsAndObj<T extends SelectSelf, Columns extends PropertyKey[], Obj> = {
    [K in keyof T]: K extends '__hasSelect' ? true : K extends '__selectable' ? T['__selectable'] & SelectAsSelectable<Obj> : K extends 'result' ? // Combine previously selected items, all columns if * was provided,
    {
        [K in ('*' extends Columns[number] ? Exclude<Columns[number], '*'> | T['__defaultSelect'] : Columns[number]) | keyof Obj as K extends Columns[number] ? T['__selectable'][K]['as'] : K]: K extends keyof Obj ? SelectAsValueResult<T, Obj[K]> : T['__selectable'][K]['column'];
    } & (T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? Omit<T['result'], Columns[number]> : unknown) : K extends 'returnType' ? SelectReturnType<T> : K extends 'then' ? QueryThenByReturnType<SelectReturnType<T>, {
        [K in ('*' extends Columns[number] ? Exclude<Columns[number], '*'> | T['__defaultSelect'] : Columns[number]) | keyof Obj as K extends Columns[number] ? T['__selectable'][K]['as'] : K]: K extends keyof Obj ? SelectAsValueResult<T, Obj[K]> : T['__selectable'][K]['column'];
    } & (T['__hasSelect'] extends (T['returnType'] extends 'value' | 'valueOrThrow' ? never : true) ? Omit<T['result'], Columns[number]> : unknown)> : T[K];
};
interface AllowedRelationOneQueryForSelectable extends IsSubQuery {
    result: Column.QueryColumns;
    returnType: 'value' | 'valueOrThrow' | 'one' | 'oneOrThrow';
}
type SelectAsSelectable<Obj> = UnionToIntersection<{
    [K in keyof Obj]: Obj[K] extends ((q: never) => infer R extends AllowedRelationOneQueryForSelectable) ? {
        [C in R['returnType'] extends 'value' | 'valueOrThrow' ? K : keyof R['result'] as R['returnType'] extends 'value' | 'valueOrThrow' ? K : `${K & string}.${C & string}`]: {
            as: C;
            column: R['returnType'] extends 'value' | 'valueOrThrow' ? R['result']['value'] : R['result'][C & keyof R['result']];
        };
    } : never;
}[keyof Obj]>;
type SelectAsValueResult<T extends SelectSelf, Arg> = Arg extends keyof T['__selectable'] ? T['__selectable'][Arg]['column'] : Arg extends Expression ? Arg['result']['value'] : Arg extends (q: never) => IsQuery ? SelectSubQueryResult<ReturnType<Arg>> : Arg extends (q: never) => Expression ? ReturnType<Arg>['result']['value'] : Arg extends (q: never) => IsQuery | Expression ? SelectSubQueryResult<Exclude<ReturnType<Arg>, Expression>> | Exclude<ReturnType<Arg>, IsQuery>['result']['value'] : never;
export type SelectSubQueryResult<Arg extends SelectSelf> = Arg['returnType'] extends undefined | 'all' ? ColumnsShape.MapToObjectArrayColumn<Arg['result']> : Arg['returnType'] extends 'value' | 'valueOrThrow' ? Arg['result']['value'] : Arg['returnType'] extends 'pluck' ? ColumnsShape.MapToPluckColumn<Arg['result']> : Arg['returnType'] extends 'one' ? ColumnsShape.MapToNullableObjectColumn<Arg['result']> : ColumnsShape.MapToObjectColumn<Arg['result']>;
export declare function _querySelect<T extends SelectSelf, Columns extends SelectArgs<T>>(q: T, columns: Columns): SelectResult<T, Columns>;
export declare function _querySelect<T extends SelectSelf, Obj extends SelectAsArg<T>>(q: T, obj: Obj): SelectResultObj<T, Obj>;
export declare function _querySelect<T extends SelectSelf, Columns extends SelectArgs<T>, Obj extends SelectAsArg<T>>(q: T, args: [...columns: Columns, obj: Obj]): SelectResultColumnsAndObj<T, Columns, Obj>;
export declare const _querySelectAll: (query: IsQuery) => void;
export declare class Select {
    /**
     * Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.
     *
     * The last argument can be an object. Keys of the object are column aliases, value can be a column name, sub-query, or raw SQL expression.
     *
     * ```ts
     * import { sql } from './baseTable'
     *
     * // select columns of the table:
     * db.table.select('id', 'name', { idAlias: 'id' });
     *
     * // accepts columns with table names:
     * db.table.select('user.id', 'user.name', { nameAlias: 'user.name' });
     *
     * // table name may refer to the current table or a joined table:
     * db.table
     *   .join(db.message, 'authorId', 'user.id')
     *   .select('user.name', 'message.text', { textAlias: 'message.text' });
     *
     * // select value from the sub-query,
     * // this sub-query should return a single record and a single column:
     * db.table.select({
     *   subQueryResult: Otherdb.table.select('column').take(),
     * });
     *
     * // select raw SQL value, specify the returning type via <generic> syntax:
     * db.table.select({
     *   raw: sql<number>`1 + 2`,
     * });
     *
     * // select raw SQL value, the resulting type can be set by providing a column type in such way:
     * db.table.select({
     *   raw: sql`1 + 2`.type((t) => t.integer()),
     * });
     *
     * // same raw SQL query as above, but the sql is returned from a callback
     * db.table.select({
     *   raw: () => sql`1 + 2`.type((t) => t.integer()),
     * });
     * ```
     *
     * When you use the ORM and defined relations, `select` can also accept callbacks with related table queries:
     *
     * ```ts
     * await db.author.select({
     *   allBooks: (q) => q.books,
     *   firstBook: (q) => q.books.order({ createdAt: 'ASC' }).take(),
     *   booksCount: (q) => q.books.count(),
     * });
     * ```
     *
     * When you're selecting a relation that's connected via `belongsTo` or `hasOne`, it becomes available to use in `order` or in `where`:
     *
     * ```ts
     * // select books with their authors included, order by author name and filter by author column:
     * await db.books
     *   .select({
     *     author: (q) => q.author,
     *   })
     *   .order('author.name')
     *   .where({ 'author.isPopular': true });
     * ```
     */
    select<T extends SelectSelf, Columns extends SelectArgs<T>>(this: T, ...args: Columns): SelectResult<T, Columns>;
    select<T extends SelectSelf, Obj extends SelectAsArg<T>>(this: T, obj: Obj): SelectResultObj<T, Obj>;
    select<T extends SelectSelf, Columns extends SelectArgs<T>, Obj extends SelectAsArg<T>>(this: T, ...args: [...columns: Columns, obj: Obj]): SelectResultColumnsAndObj<T, Columns, Obj>;
    /**
     * When querying the table or creating records, all columns are selected by default,
     * but updating and deleting queries are returning affected row counts by default.
     *
     * Use `selectAll` to select all columns. If the `.select` method was applied before it will be discarded.
     *
     * ```ts
     * const selectFull = await db.table
     *   .select('id', 'name') // discarded by `selectAll`
     *   .selectAll();
     *
     * const updatedFull = await db.table.selectAll().where(conditions).update(data);
     *
     * const deletedFull = await db.table.selectAll().where(conditions).delete();
     * ```
     */
    selectAll<T extends SelectSelf>(this: T): SelectResult<T, ['*']>;
}
export {};
