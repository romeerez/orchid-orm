import { PickQueryQAndInternal } from '../query/query';
import {
  AfterCommitHook,
  emptyArray,
  emptyObject,
  SingleSqlItem,
  TransactionAdapterBase,
  TransactionAfterCommitHook,
  TransactionState,
} from 'orchid-core';
import { QueryBase } from '../query/queryBase';
import { logParamToLogObject } from './log';

export const commitSql: SingleSqlItem = {
  text: 'COMMIT',
};

export const rollbackSql: SingleSqlItem = {
  text: 'ROLLBACK',
};

export type IsolationLevel =
  | 'SERIALIZABLE'
  | 'REPEATABLE READ'
  | 'READ COMMITTED'
  | 'READ UNCOMMITTED';

export interface TransactionOptions {
  level?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
  log?: boolean;
}

export class Transaction {
  transaction<T extends PickQueryQAndInternal, Result>(
    this: T,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  transaction<T extends PickQueryQAndInternal, Result>(
    this: T,
    options: IsolationLevel | TransactionOptions,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  async transaction<T extends PickQueryQAndInternal, Result>(
    this: T,
    cbOrOptions: IsolationLevel | TransactionOptions | (() => Promise<Result>),
    cb?: () => Promise<Result>,
  ): Promise<Result> {
    let options: TransactionOptions;
    let fn: () => Promise<Result>;
    if (typeof cbOrOptions === 'function') {
      options = emptyObject as TransactionOptions;
      fn = cbOrOptions;
    } else {
      options =
        typeof cbOrOptions === 'object' ? cbOrOptions : { level: cbOrOptions };
      fn = cb as () => Promise<Result>;
    }

    const sql = {
      values: emptyArray,
    } as unknown as SingleSqlItem;

    const log =
      options.log !== undefined
        ? this.q.log ?? logParamToLogObject(this.q.logger, options.log)
        : this.q.log;

    let logData: unknown | undefined;

    let trx = this.internal.transactionStorage.getStore();
    const transactionId = trx ? trx.transactionId + 1 : 0;

    const callback = (adapter: TransactionAdapterBase) => {
      if (log) log.afterQuery(sql, logData);
      if (log) logData = log.beforeQuery(commitSql);

      if (trx) {
        trx.transactionId = transactionId;
        return fn();
      }

      trx = {
        adapter,
        transactionId,
      };

      if (options.log !== undefined) {
        trx.log = log;
      }

      return this.internal.transactionStorage.run(trx, fn);
    };

    if (!trx) {
      sql.text = `BEGIN${
        options.level ? ` ISOLATION LEVEL ${options.level}` : ''
      }${
        options.readOnly !== undefined
          ? ` READ ${options.readOnly ? 'ONLY' : 'WRITE'}`
          : ''
      }${
        options.deferrable !== undefined
          ? ` ${options.deferrable ? '' : 'NOT '}DEFERRABLE`
          : ''
      }`;
      if (log) logData = log.beforeQuery(sql);

      try {
        const result = await this.q.adapter.transaction(sql, callback);

        if (log) log.afterQuery(commitSql, logData);

        // trx was defined in the callback above
        await runAfterCommit((trx as unknown as TransactionState).afterCommit);

        return result;
      } catch (err) {
        if (log) log.afterQuery(rollbackSql, logData);

        throw err;
      }
    } else {
      try {
        sql.text = `SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);

        const { adapter } = trx;
        await adapter.query(sql);

        let result;
        try {
          result = await callback(adapter);
        } catch (err) {
          sql.text = `ROLLBACK TO SAVEPOINT "${transactionId}"`;
          if (log) logData = log.beforeQuery(sql);
          await adapter.query(sql);
          if (log) log.afterQuery(sql, logData);
          throw err;
        }

        sql.text = `RELEASE SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);
        await adapter.query(sql);
        if (log) log.afterQuery(sql, logData);

        // transactionId is trx.testTransactionCount when only the test transactions are left,
        // and it's time to execute after commit hooks, because they won't be executed for test transactions.
        if (transactionId === trx.testTransactionCount) {
          await runAfterCommit(
            (trx as unknown as TransactionState).afterCommit,
          );
        }

        return result;
      } finally {
        trx.transactionId = transactionId - 1;
      }
    }
  }
}

const runAfterCommit = async (
  afterCommit: TransactionAfterCommitHook[] | undefined,
) => {
  if (afterCommit) {
    const promises = [];
    for (let i = 0, len = afterCommit.length; i < len; i += 3) {
      const result = afterCommit[i] as unknown[];
      const q = afterCommit[i + 1] as QueryBase;
      for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
        promises.push(fn(result, q));
      }
    }
    await Promise.all(promises);
  }
};
