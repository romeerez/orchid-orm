import { Query } from '../query/query';
import {
  DelayedRelationSelect,
  getQueryParsers,
  NotFoundError,
  QueryError,
  QueryResult,
} from '../core';
import {
  HandleResult,
  QueryAfterHook,
  QueryBeforeHookInternal,
  SelectAsValue,
  SelectItem,
} from '../sql';
import {
  AdapterBase,
  AfterCommitHook,
  applyTransforms,
  callWithThis,
  ColumnParser,
  ColumnsParsers,
  emptyArray,
  getFreeAlias,
  getValueKey,
  MaybePromise,
  QueryReturnType,
  RecordString,
  RecordUnknown,
  requirePrimaryKeys,
  SingleSql,
  SingleSqlItem,
  Sql,
  TransactionState,
} from '../core';
import {
  isInUserTransaction,
  _runAfterCommitHooks,
  commitSql,
} from './transaction';
import { processComputedResult } from '../modules/computed';

export const queryMethodByReturnType: {
  [K in string]: 'query' | 'arrays';
} = {
  undefined: 'query',
  all: 'query',
  rows: 'arrays',
  pluck: 'arrays',
  one: 'query',
  oneOrThrow: 'query',
  value: 'arrays',
  valueOrThrow: 'arrays',
  void: 'arrays',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolve = (result: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reject = (error: any) => any;

export class Then {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(this: Query, fn: (reason: any) => unknown) {
    return this.then(undefined, fn);
  }
}

// For storing error with the stacktrace leading to the code which calls `await query`,
// using it later when catching query error.
let queryError: Error = undefined as unknown as Error;

// `query.then` getter: it must be a getter to store the error with stacktrace prior to executing `await`.
const getThen = function (
  this: Query,
): (this: Query, resolve?: Resolve, reject?: Reject) => Promise<unknown> {
  queryError = new Error();
  return maybeWrappedThen;
};

Object.defineProperty(Then.prototype, 'then', {
  configurable: true,
  get: getThen,
  set(value) {
    Object.defineProperty(this, 'then', {
      value,
    });
  },
});

function maybeWrappedThen(
  this: Query,
  resolve?: Resolve,
  reject?: Reject,
): Promise<unknown> {
  const { q } = this;

  let beforeHooks: QueryBeforeHookInternal[] | undefined;
  let afterHooks: QueryAfterHook[] | undefined;
  let afterCommitHooks: QueryAfterHook[] | undefined;
  if (q.type) {
    if (q.type === 'insert' || q.type === 'upsert') {
      beforeHooks = q.beforeCreate;
      afterHooks = q.afterCreate;
      afterCommitHooks = q.afterCreateCommit;
    } else if (q.type === 'update') {
      beforeHooks = q.beforeUpdate;
      afterHooks = q.afterUpdate;
      afterCommitHooks = q.afterUpdateCommit;
    } else if (q.type === 'delete') {
      beforeHooks = q.beforeDelete;
      afterHooks = q.afterDelete;
      afterCommitHooks = q.afterDeleteCommit;
    }
  }

  const trx = this.internal.transactionStorage.getStore();
  if (
    (q.wrapInTransaction || (q.selectRelation && q.type) || afterHooks) &&
    !trx
  ) {
    return this.transaction(
      () =>
        new Promise((resolve, reject) => {
          const trx =
            this.internal.transactionStorage.getStore() as TransactionState;
          return then(
            this,
            trx.adapter,
            trx,
            beforeHooks,
            afterHooks,
            afterCommitHooks,
            resolve,
            reject,
          );
        }),
    ).then(resolve, reject);
  } else {
    return then(
      this,
      trx?.adapter || this.q.adapter,
      trx,
      beforeHooks,
      afterHooks,
      afterCommitHooks,
      resolve,
      reject,
    );
  }
}

const queriesNames: RecordString = {};
let nameI = 0;

const callAfterHook = function (
  this: [result: unknown[], q: Query],
  cb: QueryAfterHook,
): Promise<unknown> | unknown {
  return cb(this[0], this[1]);
};

const beginSql: SingleSqlItem = { text: 'BEGIN' };

const then = async (
  q: Query,
  adapter: AdapterBase,
  trx?: TransactionState,
  beforeHooks?: QueryBeforeHookInternal[],
  afterHooks?: QueryAfterHook[],
  afterCommitHooks?: QueryAfterHook[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (result: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
): Promise<unknown> => {
  const { q: query } = q;

  let sql: (Sql & { name?: string }) | undefined;
  let logData: unknown | undefined;
  const log = trx?.log ?? query.log;

  // save error to a local variable before async operations
  const localError = queryError;

  try {
    if (beforeHooks || query.before) {
      await Promise.all(
        [...(beforeHooks || emptyArray), ...(query.before || emptyArray)].map(
          callWithThis,
          q,
        ),
      );
    }

    const localSql = (sql = q.toSQL());

    const { tableHook, delayedRelationSelect } = sql;
    const { returnType = 'all' } = query;
    const tempReturnType =
      tableHook?.select ||
      (returnType === 'rows' && q.q.batchParsers) ||
      delayedRelationSelect?.value
        ? 'all'
        : returnType;

    let result: unknown;
    let queryResult: QueryResult;
    let cteData: Record<string, unknown[]> | undefined;

    if ('text' in sql) {
      if (query.autoPreparedStatements) {
        sql.name =
          queriesNames[sql.text] ||
          (queriesNames[sql.text] = (nameI++).toString(36));
      }

      if (log) {
        logData = log.beforeQuery(sql);
      }

      queryResult = await execQuery(
        adapter,
        queryMethodByReturnType[tempReturnType],
        sql,
      );

      if (log) {
        log.afterQuery(sql, logData);
        // set sql to be undefined to prevent logging on error in case if afterHooks throws
        sql = undefined;
      }

      if (localSql.cteHooks?.hasSelect) {
        const lastRowI = queryResult.rows.length - 1;
        const lastFieldI = queryResult.fields.length - 1;

        const fieldName = queryResult.fields[lastFieldI].name;
        cteData = queryResult.rows[lastRowI][fieldName];
        queryResult.fields.length = lastFieldI;
        queryResult.rowCount--;
        queryResult.rows.length = lastRowI;

        for (const row of queryResult.rows) {
          delete row[fieldName];
        }
      }

      // Has to be after log, so the same logger instance can be used in the sub-suquential queries.
      // Useful for `upsert` and `orCreate`.
      if (query.patchResult) {
        await query.patchResult(q, tableHook?.select, queryResult);
      }

      result = query.handleResult(q, tempReturnType, queryResult, localSql);
    } else {
      // autoPreparedStatements in batch doesn't seem to make sense

      const queryMethod = queryMethodByReturnType[tempReturnType] as 'query';

      const queryBatch = async (batch: SingleSql[]) => {
        for (const item of batch) {
          sql = item;

          if (log) {
            logData = log.beforeQuery(sql);
          }

          const result = await execQuery(adapter, queryMethod, sql);

          if (queryResult) {
            queryResult.rowCount += result.rowCount;
            queryResult.rows.push(...result.rows);
          } else {
            queryResult = result;
          }

          if (log) {
            log.afterQuery(sql, logData);
          }
        }

        // set sql to be undefined to prevent logging on error in case if afterHooks throws
        sql = undefined;
      };

      if (trx) {
        await queryBatch(sql.batch);
      } else {
        const { batch } = sql;

        if (log) logData = log.beforeQuery(beginSql);
        await adapter.transaction(undefined, async () => {
          if (log) log.afterQuery(beginSql, logData);
          const res = await queryBatch(batch);
          if (log) logData = log.beforeQuery(commitSql);
          return res;
        });
        if (log) log.afterQuery(commitSql, logData);
      }

      if (query.patchResult) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await query.patchResult(q, tableHook?.select, queryResult!);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result = query.handleResult(q, tempReturnType, queryResult!, localSql);
    }

    // TODO: move computeds after parsing
    let tempColumns: Set<string> | undefined;
    let renames: RecordString | undefined;
    if (tableHook?.select) {
      for (const column of tableHook.select.keys()) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { as, temp } = tableHook.select.get(column)!;
        if (as) {
          (renames ??= {})[column] = as;
        }

        if (temp) {
          (tempColumns ??= new Set())?.add(temp);
        }
      }

      if (renames) {
        for (const record of result as RecordUnknown[]) {
          for (const a in renames) {
            const value = record[renames[a]];
            record[renames[a]] = record[a];
            record[a] = value;
          }
        }
      }

      if (query.selectedComputeds) {
        const promise = processComputedResult(query, result);
        if (promise) await promise;
      }
    }

    let cteAfterHooks: (() => unknown)[] | undefined;
    let cteAfterCommitHooks: (() => unknown)[] | undefined;
    if (localSql.cteHooks) {
      const addedAfterHooks = new Set<(data: unknown, query: any) => unknown>();
      const addedAfterCommitHooks = new Set<
        (data: unknown, query: any) => unknown
      >();

      const dataPerTable = new Map<string, unknown[]>();

      for (const cteName in localSql.cteHooks.tableHooks) {
        const hook = localSql.cteHooks.tableHooks[cteName];

        const data = cteData?.[cteName];
        let tableData = dataPerTable.get(hook.table);
        if (data) {
          if (tableData) {
            tableData.push(...data);
          } else {
            tableData = [...data];
            dataPerTable.set(hook.table, tableData);
          }

          let hasParsers: boolean | undefined;
          const parsers: ColumnsParsers = {};
          for (const key in hook.shape) {
            if (hook.shape[key]._parse) {
              hasParsers = true;
              parsers[key] = hook.shape[key]._parse;
            }
          }

          if (hasParsers) {
            for (const row of data) {
              parseRecord(parsers, row);
            }
          }
        } else {
          tableData = [];
        }

        if (hook.tableHook.after) {
          const arr = (cteAfterHooks ??= []);
          for (const fn of hook.tableHook.after) {
            const hookData = addedAfterHooks.has(fn);
            if (!hookData) {
              addedAfterHooks.add(fn);
              arr.push(() => fn(tableData, q));
            }
          }
        }

        if (hook.tableHook.afterCommit) {
          const arr = (cteAfterCommitHooks ??= []);
          for (const fn of hook.tableHook.afterCommit) {
            const hookData = addedAfterCommitHooks.has(fn);
            if (!hookData) {
              addedAfterCommitHooks.add(fn);
              arr.push(() => fn(tableData, q));
            }
          }
        }
      }
    }

    const hasAfterHook =
      afterHooks ||
      afterCommitHooks ||
      query.after ||
      cteAfterHooks ||
      cteAfterCommitHooks;
    if (hasAfterHook) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (queryResult!.rowCount) {
        if (afterHooks || query.after || cteAfterHooks) {
          const args = [result, q];
          await Promise.all(
            [
              ...(afterHooks || emptyArray),
              ...(query.after || emptyArray),
              ...(cteAfterHooks || emptyArray),
            ].map(callAfterHook, args),
          );
        }

        // afterCommitHooks are executed later after transaction commit,
        // or, if we don't have transaction, they are executed intentionally after other after hooks
        if (afterCommitHooks || cteAfterCommitHooks) {
          if (isInUserTransaction(trx)) {
            if (afterCommitHooks) {
              (trx.afterCommit ??= []).push(
                result as unknown[],
                q,
                afterCommitHooks,
              );
            }

            if (cteAfterCommitHooks) {
              (trx.afterCommit ??= []).push(
                result as unknown[],
                q,
                cteAfterCommitHooks,
              );
            }
          } else {
            // result can be transformed later, reference the current form to use it in hook.
            const localResult = result as unknown[];
            // to suppress throws of sync afterCommit hooks.
            queueMicrotask(async () => {
              const promises: (unknown | Promise<unknown>)[] = [];
              if (afterCommitHooks) {
                for (const fn of afterCommitHooks) {
                  try {
                    promises.push(
                      (fn as unknown as AfterCommitHook)(localResult, q),
                    );
                  } catch (err) {
                    promises.push(Promise.reject(err));
                  }
                }
              }

              if (cteAfterCommitHooks) {
                for (const fn of cteAfterCommitHooks) {
                  try {
                    promises.push(fn());
                  } catch (err) {
                    promises.push(Promise.reject(err));
                  }
                }
              }

              await _runAfterCommitHooks(
                localResult,
                promises,
                () =>
                  [
                    ...(afterCommitHooks || emptyArray),
                    ...(cteAfterCommitHooks || emptyArray),
                  ].map((h) => h.name),
                q.q.catchAfterCommitErrors,
              );
            });
          }
        }
      } else if (query.after) {
        // TODO: why only query.after is called?
        const args = [result, q];
        await Promise.all(query.after.map(callAfterHook, args));
      }
    }

    if (delayedRelationSelect?.value) {
      const q = delayedRelationSelect.query as Query;

      const primaryKeys = requirePrimaryKeys(
        q,
        'Cannot select a relation of a table that has no primary keys',
      );
      const selectQuery = q.clone();
      selectQuery.q.type = selectQuery.q.returnType = undefined;

      const matchSourceTableIds: RecordUnknown = {};
      for (const pkey of primaryKeys) {
        matchSourceTableIds[pkey] = {
          in: (result as RecordUnknown[]).map((row) => row[pkey]),
        };
      }
      (selectQuery.q.and ??= []).push(matchSourceTableIds);

      const relationsSelect = delayedRelationSelect.value as Record<
        string,
        Query
      >;

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

      const relationsResult = (await selectQuery) as RecordUnknown[];
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
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const promise = parseBatch(q, queryResult!, delayedRelationSelect);
    if (promise) await promise;

    // can be set by hooks or by computed columns
    if (tableHook?.select || tempReturnType !== returnType) {
      if (renames) {
        // to not mutate the original result because it's passed to hooks
        const renamedResult = Array.from({
          length: (result as RecordUnknown[]).length,
        });

        for (
          let i = 0, len = (result as RecordUnknown[]).length;
          i < len;
          ++i
        ) {
          const record = (result as RecordUnknown[])[i];
          const renamedRecord = (renamedResult[i] = { ...record });
          for (const a in renames) {
            // TODO: no need to assign if the one or another is in `tempColumns`
            renamedRecord[a] = record[renames[a]];
            renamedRecord[renames[a]] = record[a];
          }
        }

        result = renamedResult;
      }

      result = filterResult(
        q,
        returnType,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        queryResult!,
        result,
        tempColumns,
        hasAfterHook,
      );
    }

    if (query.transform) {
      result = applyTransforms(query, returnType, query.transform, result);
    }

    return resolve ? resolve(result) : result;
  } catch (err) {
    let error;
    if (err instanceof adapter.errorClass) {
      error = new (q.error as unknown as new () => QueryError)();
      adapter.assignError(error, err);
      error.cause = localError;
    } else {
      error = err;
      if (error instanceof Error) {
        error.cause = localError;
      }
    }

    // shift stack by one to point to the calling code
    const stack = localError.stack;
    if (stack) {
      const from = stack.indexOf('\n');
      if (from !== -1) {
        const to = stack.indexOf('\n', from + 1);
        if (to !== -1) {
          localError.stack = stack.slice(0, from) + stack.slice(to);
        }
      }
    }

    if (log && sql) {
      log.onError(error as Error, sql as SingleSqlItem, logData);
    }

    if (reject) return reject(error);

    throw error;
  }
};

/**
 * Executes a query and in the case there are rows, but nothing was selected,
 * it populates the response with empty objects,
 * because user might expect empty objects to be returned for an empty select.
 */
const execQuery = (
  adapter: AdapterBase,
  method: 'query' | 'arrays',
  sql: SingleSql,
) => {
  return (
    adapter[method as 'query'](sql.text, sql.values) as Promise<QueryResult>
  ).then((result) => {
    if (result.rowCount && !result.rows.length) {
      result.rows.length = result.rowCount;
      result.rows.fill({});
    }

    return result;
  });
};

export const handleResult: HandleResult = (
  q,
  returnType,
  result,
  sql,
  isSubQuery,
) => {
  const parsers = getQueryParsers(q, sql.tableHook?.select);

  switch (returnType) {
    case 'all': {
      if (q.q.throwOnNotFound && result.rows.length === 0)
        throw new NotFoundError(q);

      const { rows } = result;

      if (parsers) {
        for (const row of rows) {
          parseRecord(parsers, row);
        }
      }

      return rows;
    }
    case 'one': {
      const { rows } = result;
      if (!rows.length) return;

      if (parsers) parseRecord(parsers, rows[0]);

      return rows[0];
    }
    case 'oneOrThrow': {
      const { rows } = result;
      if (!rows.length) throw new NotFoundError(q);

      if (parsers) parseRecord(parsers, rows[0]);

      return rows[0];
    }
    case 'rows': {
      const { rows } = result;

      if (parsers) {
        parseRows(parsers, result.fields, rows);
      }

      return rows;
    }
    case 'pluck': {
      const { rows } = result;

      parsePluck(parsers, isSubQuery, rows);

      return rows;
    }
    case 'value': {
      const { rows } = result;

      return rows[0]?.[0] !== undefined
        ? parseValue(rows[0][0], parsers)
        : q.q.notFoundDefault;
    }
    case 'valueOrThrow': {
      if (q.q.returning) {
        if (q.q.throwOnNotFound && result.rowCount === 0) {
          throw new NotFoundError(q);
        }
        return result.rowCount;
      }

      const { rows } = result;

      if (rows[0]?.[0] === undefined) throw new NotFoundError(q);
      return parseValue(rows[0][0], parsers);
    }
    case 'void': {
      return;
    }
  }
};

const parseBatch = (
  q: Query,
  queryResult: QueryResult,
  delayedRelationSelect?: DelayedRelationSelect,
): MaybePromise<void> => {
  let promises: Promise<void>[] | undefined;

  /**
   * In case of delayedRelationSelect, the first query does insert/update/delete,
   * it must not run batchParsers because it doesn't have the data yet.
   * The second query loads data and performs batchParsers.
   */
  if (q.q.batchParsers && !delayedRelationSelect?.value) {
    for (const parser of q.q.batchParsers) {
      const res = parser.fn(parser.path, queryResult);
      if (res) (promises ??= []).push(res);
    }
  }

  return promises && (Promise.all(promises) as never);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseRecord = (parsers: ColumnsParsers, row: any): unknown => {
  for (const key in parsers) {
    if (key in row) {
      row[key] = (parsers[key] as ColumnParser)(row[key]);
    }
  }
  return row;
};

const parseRows = (
  parsers: ColumnsParsers,
  fields: { name: string }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): void => {
  for (let i = fields.length - 1; i >= 0; i--) {
    const parser = parsers[fields[i].name];
    if (parser) {
      for (const row of rows) {
        row[i] = parser(row[i]);
      }
    }
  }
};

const parsePluck = (
  parsers: ColumnsParsers | undefined,
  isSubQuery: true | undefined,
  rows: unknown[],
): void => {
  const pluck = parsers?.pluck;
  if (pluck) {
    for (let i = 0; i < rows.length; i++) {
      rows[i] = pluck(isSubQuery ? rows[i] : (rows[i] as RecordUnknown)[0]);
    }
  } else if (!isSubQuery) {
    for (let i = 0; i < rows.length; i++) {
      rows[i] = (rows[i] as RecordUnknown)[0];
    }
  }
};

const parseValue = (value: unknown, parsers?: ColumnsParsers): unknown => {
  const parser = parsers?.[getValueKey];
  return parser ? parser(value) : value;
};

export const filterResult = (
  q: Query,
  returnType: QueryReturnType,
  queryResult: QueryResult,
  result: unknown,
  tempColumns: Set<string> | undefined,
  // result should not be mutated when having hooks, because hook may want to access the data later
  hasAfterHook?: unknown,
): unknown => {
  if (returnType === 'all') {
    return filterAllResult(result, tempColumns, hasAfterHook);
  }

  if (returnType === 'oneOrThrow' || returnType === 'one') {
    let row = (result as RecordUnknown[])[0];
    if (!row) {
      if (returnType === 'oneOrThrow') throw new NotFoundError(q);
      return undefined;
    } else if (!tempColumns?.size) {
      return row;
    } else {
      if (hasAfterHook) row = { ...row };

      for (const column of tempColumns) {
        delete row[column];
      }

      return row;
    }
  }

  if (returnType === 'value') {
    return (result as RecordUnknown[])[0]?.[
      getFirstResultKey(q, queryResult) as string
    ];
  }

  if (returnType === 'valueOrThrow') {
    if (q.q.returning) {
      return queryResult.rowCount;
    }

    const row = (result as RecordUnknown[])[0];
    if (!row) throw new NotFoundError(q);

    return row[getFirstResultKey(q, queryResult) as string];
  }

  if (returnType === 'pluck') {
    const key = getFirstResultKey(q, queryResult) as string;
    return (result as RecordUnknown[]).map((row) => row[key]);
  }

  if (returnType === 'rows') {
    result = filterAllResult(result, tempColumns, hasAfterHook);
    return (result as RecordUnknown[]).map((record) => Object.values(record));
  }

  return;
};

const getFirstResultKey = (q: Query, queryResult: QueryResult) => {
  if (q.q.select) {
    return queryResult.fields[0].name;
  } else {
    for (const key in q.q.selectedComputeds) {
      return key;
    }
  }
  return;
};

const filterAllResult = (
  result: unknown,
  tempColumns: Set<string> | undefined,
  hasAfterHook: unknown,
) => {
  if (tempColumns?.size) {
    if (hasAfterHook) {
      return (result as RecordUnknown[]).map((data) => {
        const record = { ...data };
        for (const key of tempColumns) {
          delete record[key];
        }
        return record;
      });
    } else {
      for (const record of result as RecordUnknown[]) {
        for (const key of tempColumns) {
          delete record[key];
        }
      }
    }
  }
  return result;
};
