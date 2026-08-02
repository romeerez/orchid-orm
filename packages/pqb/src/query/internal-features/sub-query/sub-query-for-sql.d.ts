import { QueryBeforeHook, QueryData } from '../../query-data';
import { ToSQLQuery } from '../../sql/to-sql';
import { PickQueryQ } from '../../pick-query-types';
export interface SubQueryForSql extends ToSQLQuery {
    __forSql: true;
}
export interface HasBeforeAndBeforeSet {
    before?: QueryBeforeHook[];
    beforeSet?: QueryData['beforeSet'];
}
export interface ArgWithBeforeAndBeforeSet {
    q: HasBeforeAndBeforeSet;
}
export interface PrepareSubQueryForSqlArg extends PickQueryQ {
    dynamicBefore?: boolean;
}
export interface PrepareSubQueryForSql {
    (mainQuery: ArgWithBeforeAndBeforeSet, subQuery: PrepareSubQueryForSqlArg): SubQueryForSql;
}
export declare const prepareSubQueryForSql: PrepareSubQueryForSql;
