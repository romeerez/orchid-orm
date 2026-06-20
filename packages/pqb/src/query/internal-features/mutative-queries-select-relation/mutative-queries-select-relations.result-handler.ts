import { Query } from '../../query';
import {
  MutativeQueriesSelectRelationsSqlProp,
  MutativeQueriesSelectRelationsSqlState,
  MutativeQueriesSelectRelationsValue,
} from './mutative-queries-select-relations.sql';
import { requirePrimaryKeys } from '../../query-columns/primary-keys';
import { _unscope } from '../../extra-features/scope/scope';
import { getFreeAlias, RecordString, RecordUnknown } from '../../../utils';
import {
  SelectAsValue,
  SelectItem,
} from '../../basic-features/select/select.sql';
import { maybeWrappedThen, ThenSavepointState } from '../../then/then';

export const checkIfNeedResultAllForMutativeQueriesSelectRelations = (
  sql: MutativeQueriesSelectRelationsSqlProp,
): MutativeQueriesSelectRelationsValue | undefined => {
  return sql.mutativeQueriesSelectRelationsState?.value;
};

export const checkIfShouldReleaseSavepointForMutativeQueriesSelectRelations = (
  sql: MutativeQueriesSelectRelationsSqlProp,
): MutativeQueriesSelectRelationsValue | undefined => {
  return sql.mutativeQueriesSelectRelationsState?.value;
};

export const loadMutativeQueriesSelectRelations = (
  sql: MutativeQueriesSelectRelationsSqlProp,
  result: unknown,
  savepointState?: ThenSavepointState,
  renames?: RecordString,
): Promise<void> | undefined =>
  sql.mutativeQueriesSelectRelationsState?.value
    ? loadRelations(
        sql.mutativeQueriesSelectRelationsState,
        result,
        savepointState,
        renames,
      )
    : undefined;

export const loadRelations = async (
  state: MutativeQueriesSelectRelationsSqlState,
  result: unknown,
  savepointState?: ThenSavepointState,
  renames?: RecordString,
): Promise<void> => {
  const q = state.query as Query;

  const primaryKeys = requirePrimaryKeys(
    q,
    'Cannot select a relation of a table that has no primary keys',
  );
  const selectQuery = _unscope(q, 'nonDeleted');
  // after cloning the mutating query:
  // type = undefined makes it a select query
  selectQuery.q.type = undefined;
  // returnType = undefined: need to select full objects for this relations loading logic to work,
  // will be transformed to what user requested later.
  selectQuery.q.returnType = undefined;
  // the original query can contain mutative withs, need to strip them all for selecting
  selectQuery.q.with = undefined;
  selectQuery.q.appendQueries = undefined;
  selectQuery.q.valuesJoinedAs = undefined;

  const matchSourceTableIds: RecordUnknown = {};
  for (const pkey of primaryKeys) {
    matchSourceTableIds[pkey] = {
      in: (result as RecordUnknown[]).map((row) => row[pkey]),
    };
  }
  (selectQuery.q.and ??= []).push(matchSourceTableIds);

  const relationsSelect = state.value as Record<string, Query>;

  const selectAs: SelectAsValue = { ...relationsSelect };

  const select: SelectItem[] = [{ selectAs }];

  const relationKeyAliases = primaryKeys.map((key) => {
    if (key in selectAs) {
      const as = getFreeAlias(selectAs, key);
      selectAs[as] = key;
      return as;
    } else {
      select.push(key);
      return key;
    }
  });

  selectQuery.q.select = select;

  const relationsResult = (await maybeWrappedThen.call(
    selectQuery,
    undefined,
    async (err) => {
      await savepointState?.activeSavepoint?.rollback(err);
      throw err;
    },
    savepointState,
  )) as RecordUnknown[];

  for (const row of result as RecordUnknown[]) {
    const relationRow = relationsResult.find((relationRow) => {
      return !primaryKeys.some(
        (key, i) => relationRow[relationKeyAliases[i]] !== row[key],
      );
    });
    if (relationRow) {
      Object.assign(row, relationRow);
    }
  }

  // when relation is loaded under the same key as a transient primary key:
  // no need to rename it because the relation was already loaded under the key name.
  if (renames) {
    for (const key in relationsSelect) {
      if (key in renames) {
        delete renames[key];
      }
    }
  }
};
