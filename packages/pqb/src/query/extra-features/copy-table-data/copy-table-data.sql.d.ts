import { ToSQLQuery } from '../../sql/to-sql';
import { SingleSql } from '../../sql/sql';
export type CopyOptions<Column = string> = {
    columns?: Column[];
    format?: 'text' | 'csv' | 'binary';
    freeze?: boolean;
    delimiter?: string;
    null?: string;
    header?: boolean | 'match';
    quote?: string;
    escape?: string;
    forceQuote?: Column[] | '*';
    forceNotNull?: Column[];
    forceNull?: Column[];
    encoding?: string;
} & ({
    from: string | {
        program: string;
    };
} | {
    to: string | {
        program: string;
    };
});
export declare const makeCopySql: (table: ToSQLQuery, copy: CopyOptions) => SingleSql;
