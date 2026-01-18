import { SelectItemExpression } from '../../expressions/select-item-expression';
import { ToSql, ToSQLCtx } from '../../sql/to-sql';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { addTopCte } from './cte.sql';
import { _clone } from '../clone/clone';
import { getShapeFromSelect } from '../select/select.utils';
import { getQueryAs } from '../as/as';
import { getSqlText } from '../../sql/sql';

export const moveQueryToCte = (
  ctx: ToSQLCtx,
  query: SubQueryForSql,
  type = query.q.type,
): {
  as: string;
  makeSelectList(isSubSql?: boolean): string[];
} => {
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
      query = _clone(query) as unknown as SubQueryForSql;
      query.q.returnType = 'one';
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      query.q.select = [{ selectAs: { value: query.q.select![0] as never } }];
      valueAs = 'value';
    }
  }

  const as = addTopCte('before', ctx, query, undefined, type);

  const makeSelectList = (isSubSql?: boolean) => {
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

    if (!isSubSql && ctx.topCtx.cteHooks?.hasSelect) {
      list.push('NULL::json');
      ctx.selectedCount = selectedCount;
    }

    return list;
  };

  return {
    as,
    makeSelectList,
  };
};

export const moveMutativeQueryToCteBase = (
  toSql: ToSql,
  ctx: ToSQLCtx,
  query: SubQueryForSql,
  type = query.q.type,
): {
  as: string;
  makeSql(isSubSql?: boolean): string;
} => {
  if (!query.q.type) {
    const as = getQueryAs(query);
    return {
      as,
      makeSql: () => getSqlText(toSql(query, query.q.type, ctx, true)),
    };
  }

  const { as, makeSelectList } = moveQueryToCte(ctx, query, type);

  return {
    as,
    // need to be called lazily for the upsert case because `ctx.cteHooks?.hasSelect` can change after the first query
    makeSql(isSubSql) {
      return 'SELECT ' + makeSelectList(isSubSql) + ` FROM "${as}"`;
    },
  };
};
