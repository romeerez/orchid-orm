import { ColumnsShape } from './columns';

export class PormError extends Error {}

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

export class QueryError<
  T extends { shape: ColumnsShape } = { shape: ColumnsShape },
> extends Error {
  message!: string;
  name!: QueryErrorName;
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

          columns[column] = true;
        });
      }
    }

    return (this.columnsCache = columns);
  }
}

export class NotFoundError extends PormError {
  constructor(message = 'Record is not found') {
    super(message);
  }
}

export class MoreThanOneRowError extends PormError {}

export class PormInternalError extends Error {}

export class UnhandledTypeError extends PormInternalError {
  constructor(value: never) {
    super(`Unhandled type: ${JSON.stringify(value)} received`);
  }
}
