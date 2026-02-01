import { PickQueryShape } from '../../pick-query-types';
import { CopyOptions, makeCopySql } from './copy-table-data.sql';
import { Query } from '../../query';
import { ToSQLQuery } from '../../sql/to-sql';

// argument of the `copy` function can accept various options
type CopyArg<T extends PickQueryShape> = CopyOptions<keyof T['shape']>;

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
export function copyTableData<T extends PickQueryShape>(
  query: T,
  arg: CopyArg<T>,
): T {
  // not cloning because not mutating query.q
  const q = Object.create(query) as Query;

  q.toSQL = () => makeCopySql(q as unknown as ToSQLQuery, arg as CopyOptions);

  return q as never;
}
