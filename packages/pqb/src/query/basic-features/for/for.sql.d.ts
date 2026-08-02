import { QueryData } from '../../query-data';
import { ToSQLCtx } from '../../sql/to-sql';
export declare const pushForSql: (ctx: ToSQLCtx, q: QueryData, type: QueryData['type'], quotedAs?: string) => void;
