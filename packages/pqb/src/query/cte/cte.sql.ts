import { emptyObject, RecordUnknown, setFreeAlias } from '../../core/utils';
import { Expression } from '../../core/raw';
import { Query } from '../query';
import { toCteSubSqlText, ToSQLCtx } from '../../sql/toSQL';
import { WithItems } from '../../sql/data';
import { SingleSql, SingleSqlItem } from '../../core/query/query';
import { _clone } from '../queryUtils';

export interface CteItem {
  // name
  n: string;
  // options
  o?: CteOptions;
  // query
  q?: Query;
  // sql
  s?: Expression;
}

export interface CteOptions {
  columns?: string[];
  recursive?: true;
  materialized?: true;
  notMaterialized?: true;
}

export interface TopCTE {
  names: RecordUnknown;
  prepend: string[];
  append: string[];
}

interface TopCteSize {
  prepend: number;
  append: number;
}

const newTopCte = (ctx: ToSQLCtx): TopCTE => ({
  names: { ...ctx.q.joinedShapes },
  prepend: [],
  append: [],
});

export const getTopCteSize = (ctx: ToSQLCtx): TopCteSize | undefined =>
  ctx.topCTE && {
    prepend: ctx.topCTE.prepend.length,
    append: ctx.topCTE.append.length,
  };

export const setTopCteSize = (ctx: ToSQLCtx, size?: TopCteSize) => {
  if (ctx.topCTE) {
    if (size) {
      ctx.topCTE.prepend.length = size.prepend;
      ctx.topCTE.append.length = size.append;
    } else {
      ctx.topCTE = undefined;
    }
  }
};

export const ctesToSql = (ctx: ToSQLCtx, ctes: WithItems): string[] =>
  ctes?.map((item) => cteToSql(ctx, item));

export const cteToSql = (ctx: ToSQLCtx, item: CteItem): string => {
  let inner: string;
  if (item.q) {
    inner = toCteSubSqlText(ctx, item.q, item.n);
  } else {
    inner = (item.s as Expression).toSQL(ctx, `"${item.n}"`);
  }

  const o = item.o ?? (emptyObject as CteOptions);
  return `${o.recursive ? 'RECURSIVE ' : ''}"${item.n}"${
    o.columns ? `(${o.columns.map((x) => `"${x}"`).join(', ')})` : ''
  } AS ${
    o.materialized
      ? 'MATERIALIZED '
      : o.notMaterialized
      ? 'NOT MATERIALIZED '
      : ''
  }(${inner})`;
};

export const prependTopCte = (ctx: ToSQLCtx, q: Query, as?: string) =>
  addTopCte('prepend', ctx, q, as);

export const appendTopCte = (ctx: ToSQLCtx, q: Query, as?: string) =>
  addTopCte('append', ctx, q, as);

export const addTopCte = (
  key: 'prepend' | 'append',
  ctx: ToSQLCtx,
  q: Query,
  as?: string,
): string => {
  const topCTE = (ctx.topCTE ??= newTopCte(ctx));

  as ??= setFreeAlias(topCTE.names, 'q', true);
  topCTE[key].push(cteToSql(ctx, { n: as, q }));
  return as;
};

export const addTopCteSql = (ctx: ToSQLCtx, as: string, sql: string): void => {
  const topCTE = (ctx.topCTE ??= newTopCte(ctx));
  topCTE.names[as] = true;
  topCTE.append.push(sql);
};

export const addWithToSql = (
  ctx: ToSQLCtx,
  sql: SingleSql,
  cteSqls?: string[],
  isSubSql?: boolean,
): void => {
  if (cteSqls || (!isSubSql && ctx.topCTE) || ctx.cteSqls) {
    const sqls: string[] = [];
    if (!isSubSql && ctx.topCTE) sqls.push(...ctx.topCTE.prepend);
    if (cteSqls) sqls.push(...cteSqls);
    if (!isSubSql && ctx.topCTE) sqls.push(...ctx.topCTE.append);
    if (ctx.cteSqls) sqls.push(...ctx.cteSqls);

    sql.text = 'WITH ' + sqls.join(', ') + ' ' + sql.text;
  }
};

export const composeCteSingleSql = (ctx: ToSQLCtx): SingleSqlItem => {
  const result = {
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
  addWithToSql(ctx, result);
  return result;
};

export const moveMutativeQueryToCte = (ctx: ToSQLCtx, query: Query): Query => {
  if (!query.q.type) return query;

  const as = prependTopCte(ctx, query);
  const select = _clone(query.baseQuery);
  select.q.select = query.q.select;
  select.q.as = select.q.from = as;
  return select;
};
