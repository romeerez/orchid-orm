import { IsQuery } from '../../query';

export type DelayedRelationSelect = {
  query: IsQuery;
  value?: { [K: string]: IsQuery };
};

export const newDelayedRelationSelect = (query: IsQuery) => ({
  query,
});

export const setDelayedRelation = (
  d: DelayedRelationSelect,
  as: string,
  value: IsQuery,
) => {
  (d.value ??= {})[as] = value;
};
