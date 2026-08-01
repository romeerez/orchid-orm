import { newToSqlCtx, ToSQLQuery } from '../../sql/to-sql';
import { escapeString } from '../../../quote';
import { pushWhereStatementSql } from '../../basic-features/where/where.sql';
import { quoteTableWithSchema, SingleSql } from '../../sql/sql';
import { Column } from '../../../columns/column';
import { ColumnsShape } from '../../../columns/columns-shape';

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

const columnsSql = (shape: Column.QueryColumns, columns: string[]) => {
  return columns
    .map((item) => `"${(shape as ColumnsShape)[item]?.data.name || item}"`)
    .join(', ');
};

export const makeCopySql = (
  table: ToSQLQuery,
  copy: CopyOptions,
): SingleSql => {
  const ctx = newToSqlCtx(table);
  const { q } = table;

  const quotedAs = `"${q.as || table.table}"`;

  const columns = copy.columns
    ? `(${columnsSql(table.shape, copy.columns)})`
    : '';

  const target = 'from' in copy ? copy.from : copy.to;

  const quotedTable = quoteTableWithSchema(table);

  ctx.sql.push(
    `COPY ${quotedTable}${columns} ${'from' in copy ? 'FROM' : 'TO'} ${
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
            : `(${columnsSql(table.shape, copy.forceQuote)})`
        }`,
      );
    if (copy.forceNotNull)
      options.push(
        `FORCE_NOT_NULL (${columnsSql(table.shape, copy.forceNotNull)})`,
      );
    if (copy.forceNull)
      options.push(`FORCE_NULL (${columnsSql(table.shape, copy.forceNull)})`);
    if (copy.encoding) options.push(`ENCODING ${escapeString(copy.encoding)}`);

    ctx.sql.push(`WITH (${options.join(', ')})`);
  }

  pushWhereStatementSql(ctx, table, q, quotedAs);

  return {
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};
