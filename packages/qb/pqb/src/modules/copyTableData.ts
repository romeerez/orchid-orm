import { Query, SetQueryKind } from '../query/query';
import { CopyOptions } from '../sql';

// argument of the `copy` function can accept various options
type CopyArg<T extends Query> = CopyOptions<keyof T['shape']>;

// Result type for the `copy` method, simply setting a query kind.
type CopyResult<T extends Query> = SetQueryKind<T, 'copy'>;

/**
 * `copyTableData` is a function to invoke a `COPY` SQL statement, it can copy from or to a file or a program.
 *
 * Copying from `STDIN` or to `STDOUT` is not supported.
 *
 * It supports all the options of the `COPY` statement of Postgres. See details in [Postgres document](https://www.postgresql.org/docs/current/sql-copy.html).
 *
 * The copying is performed by the Postgres database server, and it must have access to the file.
 *
 * Type of copy argument:
 *
 * ```ts
 * export type CopyOptions<Column = string> = {
 *   columns?: Column[];
 *   format?: 'text' | 'csv' | 'binary';
 *   freeze?: boolean;
 *   delimiter?: string;
 *   null?: string;
 *   header?: boolean | 'match';
 *   quote?: string;
 *   escape?: string;
 *   forceQuote?: Column[] | '*';
 *   forceNotNull?: Column[];
 *   forceNull?: Column[];
 *   encoding?: string;
 * } & (
 *   | {
 *       from: string | { program: string };
 *     }
 *   | {
 *       to: string | { program: string };
 *     }
 * );
 * ```
 *
 * Example usage:
 *
 * ```ts
 * import { copyTableData } from 'orchid-orm';
 *
 * await copyTableData(db.table, {
 *   columns: ['id', 'title', 'description'],
 *   from: 'path-to-file',
 * });
 * ```
 *
 * @param arg - object with copy options
 */
export function copyTableData<T extends Query>(
  query: T,
  arg: CopyArg<T>,
): CopyResult<T> {
  const q = query.clone();
  Object.assign(q.q, {
    type: 'copy',
    copy: arg,
  });
  return q as CopyResult<T>;
}
