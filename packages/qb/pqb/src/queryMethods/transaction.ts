import { Query } from '../query';
import {
  AfterCommitHook,
  emptyArray,
  emptyObject,
  QueryCommon,
  Sql,
  TransactionAdapterBase,
  TransactionState,
} from 'orchid-core';

const commitSql = {
  text: 'COMMIT',
  values: emptyArray,
};

const rollbackSql = {
  text: 'ROLLBACK',
  values: emptyArray,
};

export type IsolationLevel =
  | 'SERIALIZABLE'
  | 'REPEATABLE READ'
  | 'READ COMMITTED'
  | 'READ UNCOMMITTED';

export type TransactionOptions = {
  level: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
};

export class Transaction {
  transaction<T extends Query, Result>(
    this: T,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  transaction<T extends Query, Result>(
    this: T,
    options: IsolationLevel | TransactionOptions,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  async transaction<T extends Query, Result>(
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
    } as unknown as Sql;

    const log = this.q.log;
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
        const { afterCommit } = trx as unknown as TransactionState;
        if (afterCommit) {
          const promises = [];
          for (let i = 0, len = afterCommit.length; i < len; i += 2) {
            const q = afterCommit[i] as QueryCommon;
            const result = afterCommit[i + 1] as unknown[];
            for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
              promises.push(fn(result, q));
            }
          }
          await Promise.all(promises);
        }

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

        return result;
      } finally {
        trx.transactionId = transactionId - 1;
      }
    }
  }
}
