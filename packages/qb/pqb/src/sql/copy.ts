import { ToSQLCtx } from './toSQL';
import { CopyQueryData } from './data';
import { Query } from '../query/query';
import { quoteString } from '../quote';
import { pushWhereStatementSql } from './where';

export const pushCopySql = (
  ctx: ToSQLCtx,
  table: Query,
  query: CopyQueryData,
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
        ? quoteString(target)
        : `PROGRAM ${quoteString(target.program)}`
    }`,
  );

  if (Object.keys(copy).length > (copy.columns ? 2 : 1)) {
    const options: string[] = [];

    if (copy.format) options.push(`FORMAT ${copy.format}`);
    if (copy.freeze) options.push(`FREEZE ${copy.freeze}`);
    if (copy.delimiter)
      options.push(`DELIMITER ${quoteString(copy.delimiter)}`);
    if (copy.null) options.push(`NULL ${quoteString(copy.null)}`);
    if (copy.header) options.push(`HEADER ${copy.header}`);
    if (copy.quote) options.push(`QUOTE ${quoteString(copy.quote)}`);
    if (copy.escape) options.push(`ESCAPE ${quoteString(copy.escape)}`);
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
    if (copy.encoding) options.push(`ENCODING ${quoteString(copy.encoding)}`);

    sql.push(`WITH (${options.join(', ')})`);
  }

  pushWhereStatementSql(ctx, table, query, quotedAs);
};
