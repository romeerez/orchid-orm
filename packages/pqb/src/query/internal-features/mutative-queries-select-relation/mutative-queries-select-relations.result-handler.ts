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
import { maybeWrappedThen } from '../../then/then';
import { AdapterBase } from 'pqb/internal';

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
  adapter: AdapterBase,
  startingSavepoint?: string,
  renames?: RecordString,
): Promise<void> | undefined =>
  sql.mutativeQueriesSelectRelationsState?.value
    ? loadRelations(
        sql.mutativeQueriesSelectRelationsState,
        result,
        adapter,
        startingSavepoint,
        renames,
      )
    : undefined;

export const loadRelations = async (
  state: MutativeQueriesSelectRelationsSqlState,
  result: unknown,
  adapter: AdapterBase,
  startingSavepoint?: string,
  renames?: RecordString,
): Promise<void> => {
  const q = state.query as Query;

  const primaryKeys = requirePrimaryKeys(
    q,
    'Cannot select a relation of a table that has no primary keys',
  );
  const selectQuery = _unscope(q, 'nonDeleted');
  selectQuery.q.type = selectQuery.q.returnType = undefined;

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
      await adapter.arrays(`ROLLBACK TO SAVEPOINT "${startingSavepoint}"`);
      throw err;
    },
    startingSavepoint,
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
