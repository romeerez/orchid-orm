import { ToSQLQuery } from '../../sql/to-sql';
import { SingleSql } from '../../sql/sql';
export interface TruncateOptions {
    restartIdentity?: boolean;
    cascade?: boolean;
}
export declare const makeTruncateSql: (query: ToSQLQuery, options?: TruncateOptions) => SingleSql;
