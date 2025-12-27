import { IsQuery, QueryBase } from '../../query';

export type DelayedRelationSelect = {
  query: QueryBase;
  value?: { [K: string]: IsQuery };
};

export const newDelayedRelationSelect = (query: QueryBase) => ({
  query,
});

export const setDelayedRelation = (
  d: DelayedRelationSelect,
  as: string,
  value: IsQuery,
) => {
  (d.value ??= {})[as] = value;
};
