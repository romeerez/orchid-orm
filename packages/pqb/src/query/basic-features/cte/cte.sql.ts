import { emptyObject, RecordUnknown, setFreeAlias } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { toSql, ToSQLCtx } from '../../sql/to-sql';
import { QueryData, WithItems } from '../../query-data';
import { Column } from '../../../columns';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { moveMutativeQueryToCteBase } from './move-mutative-query-to-cte-base.sql';
import { setMoveMutativeQueryToCte } from '../../../columns/operators';
import { getSqlText, SingleSql, SingleSqlItem } from '../../sql/sql';

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
  // prepend: false by default
  p?: boolean;
}

export interface CteOptions {
  columns?: string[];
  recursive?: true;
  materialized?: true;
  notMaterialized?: true;
}

export interface TopCTE {
  names: RecordUnknown;
  stack: string[][];
  append: string[][];
}

const newTopCte = (ctx: ToSQLCtx): TopCTE => ({
  names: { ...ctx.q.withShapes, ...ctx.q.joinedShapes },
  stack: [],
  append: [],
});

export const getTopCteSize = ({
  topCtx: { topCTE },
}: ToSQLCtx): number | undefined => topCTE?.append.length;

export const setTopCteSize = ({ topCtx }: ToSQLCtx, size?: number) => {
  if (topCtx.topCTE) {
    if (size) {
      topCtx.topCTE.append.length = size;
    } else {
      topCtx.topCTE = undefined;
    }
  }
};

export const ctesToSql = (ctx: ToSQLCtx, ctes?: WithItems): void => {
  if (!ctes) return;

  for (const item of ctes) {
    const place = item.p ? 'before' : 'after';
    if (ctx !== ctx.topCtx && item.q?.q.type) {
      addTopCte(place, ctx, item.q, item.n);
    } else {
      addTopCteInternal(place, ctx, item);
    }
  }
};

export const cteToSqlGiveAs = (
  ctx: ToSQLCtx,
  item: CteItem,
  type?: QueryData['type'],
): { as: string; sql: string } => {
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
  return {
    as,
    sql: `${o.recursive ? 'RECURSIVE ' : ''}"${as}"${
      o.columns ? `(${o.columns.map((x) => `"${x}"`).join(', ')})` : ''
    } AS ${
      o.materialized
        ? 'MATERIALIZED '
        : o.notMaterialized
        ? 'NOT MATERIALIZED '
        : ''
    }(${inner})`,
  };
};

export const cteToSql = (
  ctx: ToSQLCtx,
  item: CteItem,
  type?: QueryData['type'],
): string => cteToSqlGiveAs(ctx, item, type).sql;

export const setFreeTopCteAs = (ctx: ToSQLCtx) => {
  const topCTE = (ctx.topCtx.topCTE ??= newTopCte(ctx));
  const as = setFreeAlias(topCTE.names, 'q', true);
  topCTE.names[as] = true;
  return as;
};

export const addTopCteSql = (
  ctx: ToSQLCtx,
  as: string | undefined,
  sql: string,
): string => {
  const topCTE = (ctx.topCtx.topCTE ??= newTopCte(ctx));

  as ??= setFreeAlias(topCTE.names, 'q', true);
  topCTE.names[as] = true;

  const target =
    topCTE.stack[topCTE.stack.length - 1] ||
    (topCTE.append[topCTE.append.length] = []);

  target.push(as + ' AS (' + sql + ')');
  return as;
};

export const addTopCte = (
  place: 'before' | 'after',
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

  addTopCteInternal(place, ctx, { n: as, q }, type);

  return as;
};

const addTopCteInternal = (
  place: 'before' | 'after',
  ctx: ToSQLCtx,
  item: CteItem,
  type?: QueryData['type'],
) => {
  const topCTE = (ctx.topCtx.topCTE ??= newTopCte(ctx));

  const target =
    (place === 'before' && topCTE.stack[topCTE.stack.length - 1]) ||
    (topCTE.append[topCTE.append.length] = []);

  const prepend: string[] = [];
  topCTE.stack.push(prepend);

  const sql = cteToSql(ctx, item, type); // more ctes can be appended here

  target.push(...prepend, sql);

  topCTE.stack.pop();
};

export const addWithToSql = (
  ctx: ToSQLCtx,
  sql: SingleSql,
  isSubSql?: boolean,
): void => {
  if (!isSubSql && ctx.topCtx.topCTE) {
    const sqls: string[] = [];
    if (!isSubSql && ctx.topCtx.topCTE) {
      for (const append of ctx.topCtx.topCTE.append) {
        sqls.push(...append);
      }
    }

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
  const { makeSql } = moveMutativeQueryToCteBase(toSql, ctx, query);
  return makeSql(true);
};

setMoveMutativeQueryToCte(moveMutativeQueryToCte);
