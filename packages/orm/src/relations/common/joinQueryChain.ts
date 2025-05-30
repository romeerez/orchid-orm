import {
  cloneQueryBaseUnscoped,
  DynamicRawSQL,
  getQueryAs,
  getShapeFromSelect,
  Query,
  RawSQL,
  RelationJoinQuery,
} from 'pqb';
import { ColumnsShapeBase, HookSelectValue, isExpression } from 'orchid-core';

export const joinQueryChainHOF =
  (
    relPKeys: string[],
    reverseJoin: RelationJoinQuery,
    joinQuery: RelationJoinQuery,
  ): RelationJoinQuery =>
  (joiningQuery, baseQuery) => {
    const jq = joiningQuery as Query;
    const chain = jq.q.relChain;
    if (!chain || chain.length === 1) {
      return joinQuery(jq, baseQuery);
    }

    const last = chain[chain.length - 1];
    const query = (
      'relationConfig' in last
        ? last.relationConfig.joinQuery(last, baseQuery)
        : last
    ) as Query;

    const result = jq.join(
      { _internalJoin: reverseJoin(query, jq) } as never,
      undefined,
    );

    if (!query.q.chainMultiple) {
      return result;
    }

    const item = selectRowNumber(result, relPKeys);
    combineOrdering(result, query);
    if (!result.q.select) result.q.select = ['*'];
    return wrapQuery(jq, result, item);
  };

const selectRowNumber = (
  result: Query,
  relPKeys: string[],
): HookSelectValue => {
  const hookSelect = (result.q.hookSelect = new Map(
    result.q.hookSelect && [...result.q.hookSelect],
  ));
  const as = `"${getQueryAs(result)}"`;
  const partitionColumns = relPKeys.map(
    (key) =>
      `${as}."${(result.shape as ColumnsShapeBase)[key]?.data.name || key}"`,
  );
  const item = {
    select: {
      sql: `row_number() OVER (PARTITION BY ${partitionColumns.join(', ')})`,
    },
  };

  hookSelect.set('r', item);

  return item;
};

const combineOrdering = (result: Query, joined: Query) => {
  const { order } = joined.q;
  if (order) {
    const as = getQueryAs(joined);

    const add = order.map((o) =>
      typeof o === 'string'
        ? `${as}.${o}`
        : isExpression(o)
        ? o
        : Object.fromEntries(
            Object.entries(o).map(([key, value]) => [`${as}.${key}`, value]),
          ),
    );

    const arr = result.q.order;
    result.q.order = arr ? [...add, ...arr] : add;
  }
};

const wrapQuery = (
  joiningQuery: Query,
  result: Query,
  item: HookSelectValue,
) => {
  const baseOuterQuery = cloneQueryBaseUnscoped(joiningQuery);
  const outer = baseOuterQuery.clone();

  outer.q.and = [new DynamicRawSQL(() => new RawSQL(`${item.as || 'r'} = 1`))];
  outer.q.useFromLimitOffset = true;
  outer.shape = getShapeFromSelect(result, true);
  outer.q.select = Object.keys(outer.shape);
  outer.q.returnType = result.q.returnType;

  result.q.returnsOne = true;
  return result.wrap(outer);
};
