import { emptyObject, RecordUnknown, setFreeAlias } from '../../core/utils';
import { Expression } from '../../core/raw';
import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData, WithItems } from '../../sql/data';
import { SingleSql, SingleSqlItem } from '../../core/query/query';
import { Column } from '../../columns';
import { SubQueryForSql } from '../to-sql/sub-query-for-sql';
import { moveMutativeQueryToCteBase } from './move-mutative-query-to-cte-base.sql';
import { setMoveMutativeQueryToCte } from '../../columns/operators';
import { getSqlText, toSql } from '../../sql';

export interface WithDataItem {
  table: string;
  shape: Column.QueryColumns;
}

export interface WithDataItems {
  [K: string]: WithDataItem;
}

export interface CteItem {
  // name
  n: string | ((as: string) => void);
  // options
  o?: CteOptions;
  // query
  q?: SubQueryForSql;
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

export const getTopCteSize = ({
  topCtx: { topCTE },
}: ToSQLCtx): TopCteSize | undefined =>
  topCTE && {
    prepend: topCTE.prepend.length,
    append: topCTE.append.length,
  };

export const setTopCteSize = ({ topCtx }: ToSQLCtx, size?: TopCteSize) => {
  if (topCtx.topCTE) {
    if (size) {
      topCtx.topCTE.prepend.length = size.prepend;
      topCtx.topCTE.append.length = size.append;
    } else {
      topCtx.topCTE = undefined;
    }
  }
};

export const ctesToSql = (
  ctx: ToSQLCtx,
  ctes?: WithItems,
): string[] | undefined => {
  if (!ctes) return;

  let result: string[] | undefined;
  for (const item of ctes) {
    if (ctx !== ctx.topCtx && item.q?.q.type) {
      addTopCte('prepend', ctx, item.q, item.n);
    } else {
      (result ||= []).push(cteToSql(ctx, item));
    }
  }
  return result;
};

export const cteToSql = (
  ctx: ToSQLCtx,
  item: CteItem,
  type?: QueryData['type'],
): string => {
  let inner: string;

  let as;
  if (typeof item.n === 'string') {
    as = item.n;
  } else {
    if (ctx === ctx.topCtx) {
      const topCTE = (ctx.topCtx.topCTE ??= newTopCte(ctx));
      as = setFreeAlias(topCTE.names, 'q', true);
      item.n(as);
    } else {
      // TODO
      throw new Error('not implemented yet');
    }
  }

  if (item.q) {
    inner = getSqlText(
      toSql(
        item.q,
        type === undefined ? item.q.q.type : type,
        ctx.topCtx,
        true,
        as,
      ),
    );
  } else {
    inner = (item.s as Expression).toSQL(ctx.topCtx, `"${as}"`);
  }

  const o = item.o ?? (emptyObject as CteOptions);
  return `${o.recursive ? 'RECURSIVE ' : ''}"${as}"${
    o.columns ? `(${o.columns.map((x) => `"${x}"`).join(', ')})` : ''
  } AS ${
    o.materialized
      ? 'MATERIALIZED '
      : o.notMaterialized
      ? 'NOT MATERIALIZED '
      : ''
  }(${inner})`;
};

export const prependTopCte = (
  ctx: ToSQLCtx,
  q: SubQueryForSql,
  as?: string,
  type?: QueryData['type'],
) => addTopCte('prepend', ctx, q, as, type);

export const addTopCte = (
  key: 'prepend' | 'append',
  ctx: ToSQLCtx,
  q: SubQueryForSql,
  as?: string | ((as: string) => void),
  type?: QueryData['type'],
): string => {
  const topCTE = (ctx.topCtx.topCTE ??= newTopCte(ctx));

  if (typeof as !== 'string') {
    const name = setFreeAlias(topCTE.names, 'q', true);

    if (as) {
      as(name);
    }

    as = name;
  }

  topCTE[key].push(cteToSql(ctx, { n: as, q }, type));

  return as;
};

export const addWithToSql = (
  ctx: ToSQLCtx,
  sql: SingleSql,
  cteSqls?: string[],
  isSubSql?: boolean,
): void => {
  if (cteSqls?.length || (!isSubSql && ctx.topCtx.topCTE) || ctx.cteSqls) {
    const sqls: string[] = [];
    if (!isSubSql && ctx.topCtx.topCTE) sqls.push(...ctx.topCtx.topCTE.prepend);
    if (cteSqls) sqls.push(...cteSqls);
    if (!isSubSql && ctx.topCtx.topCTE) sqls.push(...ctx.topCtx.topCTE.append);
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

export interface MoveMutativeQueryToCte {
  (ctx: ToSQLCtx, query: SubQueryForSql): string;
}

export const moveMutativeQueryToCte: MoveMutativeQueryToCte = (ctx, query) => {
  const { makeSql } = moveMutativeQueryToCteBase(ctx, query);
  return makeSql(true);
};

setMoveMutativeQueryToCte(moveMutativeQueryToCte);
