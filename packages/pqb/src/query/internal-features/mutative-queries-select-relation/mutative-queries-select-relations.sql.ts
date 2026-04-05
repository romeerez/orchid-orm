import { IsQuery, Query } from '../../query';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { _clone } from '../../basic-features/clone/clone';
import {
  prepareSubQueryForSql,
  SubQueryForSql,
} from '../sub-query/sub-query-for-sql';
import { requirePrimaryKeys } from '../../query-columns/primary-keys';
import {
  _addToHookSelect,
  HookSelect,
  HookSelectValue,
} from '../../basic-features/select/hook-select';
import { moveQueryToCte } from '../../basic-features/cte/move-mutative-query-to-cte-base.sql';
import { ensureCTECount } from '../../extra-features/hooks/hooks.sql';
import { JoinItem } from '../../basic-features/join/join.sql';

export interface MutativeQueriesSelectRelationsQueryData {
  selectRelation?: true;
}

export interface MutativeQueriesSelectRelationsSqlProp {
  mutativeQueriesSelectRelationsState?: MutativeQueriesSelectRelationsSqlState;
}

export interface MutativeQueriesSelectRelationsSqlState {
  query: IsQuery;
  value?: MutativeQueriesSelectRelationsValue;
}

export interface MutativeQueriesSelectRelationsValue {
  [K: string]: IsQuery;
}

export const newMutativeQueriesSelectRelationsSqlState = (
  query: ToSQLQuery,
): MutativeQueriesSelectRelationsSqlState | undefined =>
  query.q.selectRelation && {
    query,
  };

export const setMutativeQueriesSelectRelationsSqlState = (
  d: MutativeQueriesSelectRelationsSqlState,
  as: string,
  rel: IsQuery,
) => {
  (d.value ??= {})[as] = rel;
};

export const handleInsertAndUpdateSelectRelationsSqlState = (
  ctx: ToSQLCtx,
  state: MutativeQueriesSelectRelationsSqlState | undefined,
) => {
  if (state) {
    ctx.topCtx.mutativeQueriesSelectRelationsSqlState = state;
  }
};

export const handleDeleteSelectRelationsSqlState = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  relationSelectState: MutativeQueriesSelectRelationsSqlState | undefined,
  returning: string | undefined,
):
  | {
      join: JoinItem;
      joinedShape: string;
      movedWhereToCte: boolean;
      addReturning: string;
    }
  | undefined => {
  const selectRelations = relationSelectState?.value;
  if (!selectRelations) return;

  const selectPrimaryKeysQuery = prepareSubQueryForSql(query, _clone(query));

  const primaryKeys = requirePrimaryKeys(
    query as Query,
    'primary keys are required for selecting relation in delete',
  );

  _addToHookSelect(selectPrimaryKeysQuery, primaryKeys, true);

  const { as: cteAs } = moveQueryToCte(
    ctx,
    selectPrimaryKeysQuery as unknown as SubQueryForSql,
    undefined,
    true,
  );

  const relKeys = Object.keys(selectRelations);

  ctx.selectedCount = (returning ? ctx.selectedCount : 0) + relKeys.length;

  const hookSelect = selectPrimaryKeysQuery.q.hookSelect as HookSelect;

  const join: JoinItem = {
    type: 'JOIN',
    args: {
      w: cteAs,
      a: [
        Object.fromEntries(
          primaryKeys.map((key) => {
            const selected = hookSelect.get(key) as HookSelectValue;
            return [
              cteAs + '.' + ((selected.as || selected.select) as string),
              key,
            ];
          }),
        ),
      ],
    },
  };

  for (const relKey in selectRelations) {
    const rel = selectRelations[relKey] as Query;
    if (
      rel.q.returnType === 'oneOrThrow' ||
      rel.q.returnType === 'valueOrThrow'
    ) {
      ensureCTECount(ctx, cteAs, { jsonNotNull: relKey });
    }
  }

  return {
    join,
    joinedShape: cteAs,
    movedWhereToCte: true,
    addReturning: relKeys.map((key) => `${cteAs}."${key}"`).join(', '),
  };
};

export const setMutativeQueriesSelectRelationsStateOnSql = (
  ctx: ToSQLCtx,
  sql: MutativeQueriesSelectRelationsSqlProp,
) => {
  sql.mutativeQueriesSelectRelationsState =
    ctx.topCtx.mutativeQueriesSelectRelationsSqlState;
};
