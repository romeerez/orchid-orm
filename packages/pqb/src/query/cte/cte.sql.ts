import { emptyObject, RecordUnknown, setFreeAlias } from '../../core/utils';
import { Expression } from '../../core/raw';
import { Query } from '../query';
import { toCteSubSqlText, ToSQLCtx, toSubSqlText } from '../../sql/toSQL';
import { QueryData, WithItems } from '../../sql/data';
import { SingleSql, SingleSqlItem } from '../../core/query/query';
import { _clone } from '../queryUtils';
import { getQueryAs } from '../../common/utils';
import { getShapeFromSelect } from '../../queryMethods/select/select';
import { SelectItemExpression } from '../../common/select-item-expression';
import { QueryColumns } from '../../core';

export interface WithDataItem {
  table: string;
  shape: QueryColumns;
}

export interface WithDataItems {
  [K: string]: WithDataItem;
}

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

export const cteToSql = (
  ctx: ToSQLCtx,
  item: CteItem,
  type?: QueryData['type'],
): string => {
  let inner: string;
  if (item.q) {
    inner = toCteSubSqlText(ctx, item.q, item.n, type);
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

export const prependTopCte = (
  ctx: ToSQLCtx,
  q: Query,
  as?: string,
  type?: QueryData['type'],
) => addTopCte('prepend', ctx, q, as, type);

export const addTopCte = (
  key: 'prepend' | 'append',
  ctx: ToSQLCtx,
  q: Query,
  as?: string,
  type?: QueryData['type'],
): string => {
  const topCTE = (ctx.topCTE ??= newTopCte(ctx));

  as ??= setFreeAlias(topCTE.names, 'q', true);
  topCTE[key].push(cteToSql(ctx, { n: as, q }, type));
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

export const moveMutativeQueryToCte = (
  ctx: ToSQLCtx,
  query: Query,
  cteName?: string,
  type = query.q.type,
): { as: string; makeSql: (isSubSql?: boolean) => string } => {
  if (!query.q.type) {
    return {
      as: getQueryAs(query),
      makeSql: () => toSubSqlText(ctx, query, type),
    };
  }

  const { returnType } = query.q;

  let valueAs: string | undefined;
  if (
    returnType === 'value' ||
    returnType === 'valueOrThrow' ||
    returnType === 'pluck'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const first = query.q.select![0];
    if (
      first instanceof SelectItemExpression &&
      typeof first.item === 'string'
    ) {
      valueAs = first.item;
    } else {
      query = _clone(query);
      query.q.returnType = 'one';
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      query.q.select = [{ selectAs: { value: query.q.select![0] as never } }];
      valueAs = 'value';
    }
  }

  const as = prependTopCte(ctx, query, cteName, type);

  return {
    as,
    // need to be called lazily for the upsert case because `ctx.cteHooks?.hasSelect` can change after the first query
    makeSql(isSubSql) {
      const list: string[] = [];

      let selectedCount = 0;
      if (valueAs) {
        selectedCount = 1;
        list.push(`"${as}"."${valueAs}"`);
      } else if (returnType !== 'void') {
        const shape = getShapeFromSelect(query, true);
        const keys = Object.keys(shape);
        selectedCount = keys.length;
        list.push(...keys.map((key) => `"${as}"."${key}"`));
      }

      if (!isSubSql && ctx.cteHooks?.hasSelect) {
        list.push('NULL::json');
        ctx.selectedCount = selectedCount;
      }

      return 'SELECT ' + list.join(', ') + ` FROM "${as}"`;
    },
  };
};
