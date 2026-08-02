import { SingleSql } from '../../sql/sql';
export interface QueryLogObject {
    colors: boolean;
    beforeQuery(sql: SingleSql): unknown;
    afterQuery(sql: SingleSql, logData: unknown): void;
    onError(error: Error, sql: SingleSql, logData: unknown): void;
}
export interface QueryLogger {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export interface QueryLogOptions {
    log?: boolean | Partial<QueryLogObject>;
    logger?: QueryLogger;
}
export declare const logColors: {
    boldCyanBright: (message: string) => string;
    boldBlue: (message: string) => string;
    boldYellow: (message: string) => string;
    boldMagenta: (message: string) => string;
    boldRed: (message: string) => string;
};
export declare const logParamToLogObject: (logger: QueryLogger, log: QueryLogOptions['log']) => QueryLogObject | undefined;
export declare class QueryLog {
    /**
     * Override the `log` option, which can also be set in `createDb` or when creating a table instance:
     *
     * ```ts
     * // turn log on for this query:
     * await db.table.all().log(true);
     * await db.table.all().log(); // no argument for true
     *
     * // turn log off for this query:
     * await db.table.all().log(false);
     * ```
     *
     * Use {@link $withOptions} to override `log` for a scope of a callback.
     */
    log<T>(this: T, log?: boolean): T;
}
