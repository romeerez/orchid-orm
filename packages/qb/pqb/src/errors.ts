import { Query } from './query/query';
import { PickQueryShape } from 'orchid-core';

export abstract class OrchidOrmError extends Error {}

/**
 * When we search for a single record, and it is not found, it can either throw an error, or return `undefined`.
 *
 * Unlike other database libraries, `Orchid ORM` decided to throw errors by default when using methods `take`, `find`, `findBy`, `get` and the record is not found.
 * It is a [good practice](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md) to catch common errors in a centralized place (see [global error handling](https://orchid-orm.netlify.app/guide/error-handling.html#global-error-handling)), and this allows for a more concise code.
 *
 * If it's more suitable to get the `undefined` value instead of throwing, use `takeOptional`, `findOptional`, `findByOptional`, `getOptional` instead.
 */
export class NotFoundError extends OrchidOrmError {
  // `#query` is private to prevent it from serializing to not cause problems to test runner reports
  readonly #query: Query;

  constructor(query: Query, message = 'Record is not found') {
    super(message);
    this.#query = query;
  }

  get query() {
    return this.#query;
  }
}

export class OrchidOrmInternalError extends Error {
  // `#query` is private to prevent it from serializing to not cause problems to test runner reports
  readonly #query: Query;

  constructor(query: Query, message?: string) {
    super(message);
    this.#query = query;
  }

  get query() {
    return this.#query;
  }
}

export type QueryErrorName =
  | 'parseComplete'
  | 'bindComplete'
  | 'closeComplete'
  | 'noData'
  | 'portalSuspended'
  | 'replicationStart'
  | 'emptyQuery'
  | 'copyDone'
  | 'copyData'
  | 'rowDescription'
  | 'parameterDescription'
  | 'parameterStatus'
  | 'backendKeyData'
  | 'notification'
  | 'readyForQuery'
  | 'commandComplete'
  | 'dataRow'
  | 'copyInResponse'
  | 'copyOutResponse'
  | 'authenticationOk'
  | 'authenticationMD5Password'
  | 'authenticationCleartextPassword'
  | 'authenticationSASL'
  | 'authenticationSASLContinue'
  | 'authenticationSASLFinal'
  | 'error'
  | 'notice';

export abstract class QueryError<
  T extends PickQueryShape = PickQueryShape,
> extends OrchidOrmInternalError {
  declare message: string;
  declare name: QueryErrorName;
  declare stack: string | undefined;
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

  get isUnique() {
    return this.code === '23505';
  }

  columnsCache?: { [K in keyof T['shape']]?: true };
  get columns() {
    if (this.columnsCache) return this.columnsCache;

    const columns: { [K in keyof T['shape']]?: true } = {};

    if (this.detail) {
      const list = this.detail.match(/\((.*)\)=/)?.[1];
      if (list) {
        list.split(', ').forEach((item) => {
          const column = (
            item.startsWith('"') ? item.slice(1, -1) : item
          ) as keyof T['shape'];

          const key = this.query.columnNameToKey(column as string) ?? column;
          columns[key as keyof T['shape']] = true;
        });
      }
    }

    return (this.columnsCache = columns);
  }
}

export class MoreThanOneRowError extends OrchidOrmInternalError {
  constructor(query: Query, message?: string) {
    super(query, message);
  }
}

export class UnhandledTypeError extends OrchidOrmInternalError {
  constructor(query: Query, value: never) {
    super(query, `Unhandled type: ${JSON.stringify(value)} received`);
  }
}
