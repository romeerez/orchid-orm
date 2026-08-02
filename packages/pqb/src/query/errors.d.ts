import { RecordUnknown } from '../utils';
import { PickQueryShape } from './pick-query-types';
import { IsQuery, Query } from './query';
export declare abstract class OrchidOrmError extends Error {
}
/**
 * When we search for a single record, and it is not found, it can either throw an error, or return `undefined`.
 *
 * Unlike other database libraries, `Orchid ORM` decided to throw errors by default when using methods `take`, `find`, `findBy`, `get` and the record is not found.
 * It is a [good practice](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md) to catch common errors in a centralized place (see [global error handling](https://orchid-orm.netlify.app/guide/error-handling.html#global-error-handling)), and this allows for a more concise code.
 *
 * If it's more suitable to get the `undefined` value instead of throwing, use `takeOptional`, `findOptional`, `findByOptional`, `getOptional` instead.
 */
export declare class NotFoundError extends OrchidOrmError {
    #private;
    constructor(query: IsQuery, message?: string);
    getQuery(): Query;
}
export declare class OrchidOrmInternalError extends Error {
    #private;
    data?: RecordUnknown | undefined;
    constructor(query: IsQuery, message?: string, data?: RecordUnknown | undefined);
    getQuery(): Query;
}
export type QueryErrorName = 'parseComplete' | 'bindComplete' | 'closeComplete' | 'noData' | 'portalSuspended' | 'replicationStart' | 'emptyQuery' | 'copyDone' | 'copyData' | 'rowDescription' | 'parameterDescription' | 'parameterStatus' | 'backendKeyData' | 'notification' | 'readyForQuery' | 'commandComplete' | 'dataRow' | 'copyInResponse' | 'copyOutResponse' | 'authenticationOk' | 'authenticationMD5Password' | 'authenticationCleartextPassword' | 'authenticationSASL' | 'authenticationSASLContinue' | 'authenticationSASLFinal' | 'error' | 'notice';
export declare abstract class QueryError<T extends PickQueryShape = PickQueryShape> extends OrchidOrmInternalError {
    #private;
    message: string;
    length?: number;
    name: QueryErrorName;
    stack: string | undefined;
    code: string | undefined;
    detail: string | undefined;
    severity: string | undefined;
    hint: string | undefined;
    position: string | undefined;
    internalPosition: string | undefined;
    internalQuery: string | undefined;
    where: string | undefined;
    schema: string | undefined;
    table: string | undefined;
    column: string | undefined;
    dataType: string | undefined;
    constraint: string | undefined;
    file: string | undefined;
    line: string | undefined;
    routine: string | undefined;
    get isUnique(): boolean;
    get columns(): { [K in keyof T["shape"]]?: true | undefined; };
}
export declare class MoreThanOneRowError extends OrchidOrmInternalError {
    constructor(query: IsQuery, message?: string);
}
export declare class UnhandledTypeError extends OrchidOrmInternalError {
    constructor(query: IsQuery, value: never);
}
/**
 * Error thrown when attempting to nest SQL session scopes.
 * Nested withOptions/$withOptions calls that supply role or setConfig while an outer
 * scope already has SQL session state defined will throw this error.
 */
export declare class NestedSqlSessionError extends OrchidOrmInternalError {
    constructor(query: IsQuery);
}
export declare class CannotMutateReadOnlyTableError extends OrchidOrmInternalError {
    constructor(query: IsQuery);
}
