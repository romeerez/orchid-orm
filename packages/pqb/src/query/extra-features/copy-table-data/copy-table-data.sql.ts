import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { escapeString } from '../../../quote';
import { pushWhereStatementSql } from '../../basic-features/where/where.sql';

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
} & (
  | {
      from: string | { program: string };
    }
  | {
      to: string | { program: string };
    }
);

export const pushCopySql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData,
  quotedAs?: string,
) => {
  const { sql } = ctx;
  const { copy } = query;

  const columns = copy.columns
    ? `(${copy.columns
        .map((item) => `"${query.shape[item]?.data.name || item}"`)
        .join(', ')})`
    : '';

  const target = 'from' in copy ? copy.from : copy.to;

  sql.push(
    `COPY "${table.table as string}"${columns} ${
      'from' in copy ? 'FROM' : 'TO'
    } ${
      typeof target === 'string'
        ? escapeString(target)
        : `PROGRAM ${escapeString(target.program)}`
    }`,
  );

  if (Object.keys(copy).length > (copy.columns ? 2 : 1)) {
    const options: string[] = [];

    if (copy.format) options.push(`FORMAT ${copy.format}`);
    if (copy.freeze) options.push(`FREEZE ${copy.freeze}`);
    if (copy.delimiter)
      options.push(`DELIMITER ${escapeString(copy.delimiter)}`);
    if (copy.null) options.push(`NULL ${escapeString(copy.null)}`);
    if (copy.header) options.push(`HEADER ${copy.header}`);
    if (copy.quote) options.push(`QUOTE ${escapeString(copy.quote)}`);
    if (copy.escape) options.push(`ESCAPE ${escapeString(copy.escape)}`);
    if (copy.forceQuote)
      options.push(
        `FORCE_QUOTE ${
          copy.forceQuote === '*'
            ? '*'
            : `(${copy.forceQuote.map((x) => `"${x}"`).join(', ')})`
        }`,
      );
    if (copy.forceNotNull)
      options.push(
        `FORCE_NOT_NULL (${copy.forceNotNull.map((x) => `"${x}"`).join(', ')})`,
      );
    if (copy.forceNull)
      options.push(
        `FORCE_NULL (${copy.forceNull.map((x) => `"${x}"`).join(', ')})`,
      );
    if (copy.encoding) options.push(`ENCODING ${escapeString(copy.encoding)}`);

    sql.push(`WITH (${options.join(', ')})`);
  }

  pushWhereStatementSql(ctx, table, query, quotedAs);
};
