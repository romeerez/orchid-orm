import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { Expression } from '../../expressions/expression';
import { Query } from '../../query';
import { ToSQLCtx } from '../../sql/to-sql';
export interface UnionItem {
    a: SubQueryForSql | Expression;
    k: UnionKind;
    p?: boolean;
}
export interface UnionSet {
    b: Query;
    u: UnionItem[];
}
export type UnionKind = 'UNION' | 'UNION ALL' | 'INTERSECT' | 'INTERSECT ALL' | 'EXCEPT' | 'EXCEPT ALL';
export interface QueryDataUnion {
    b: SubQueryForSql;
    u: UnionItem[];
    p?: boolean;
}
export declare const pushUnionSql: (ctx: ToSQLCtx, union: QueryDataUnion, quotedAs?: string) => void;
