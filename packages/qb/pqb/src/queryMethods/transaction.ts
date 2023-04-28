import { Query } from '../query';
import { emptyArray, emptyObject, Sql } from 'orchid-core';
import { TransactionAdapter } from '../adapter';

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

    const log = this.query.log;
    let logData: unknown | undefined;

    const trx =
      this.internal.transactionStorage.getStore() as TransactionAdapter & {
        transactionId: number;
      };
    const transactionId = trx ? trx.transactionId + 1 : 0;

    const callback = (adapter: TransactionAdapter) => {
      if (log) log.afterQuery(sql, logData);
      if (log) logData = log.beforeQuery(commitSql);

      (adapter as unknown as { transactionId: number }).transactionId =
        transactionId;

      return trx ? fn() : this.internal.transactionStorage.run(adapter, fn);
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

      const t = this.query.adapter.transaction(sql, callback);

      if (log) {
        t.then(
          () => log.afterQuery(commitSql, logData),
          () => log.afterQuery(rollbackSql, logData),
        );
      }

      return t;
    } else {
      try {
        sql.text = `SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);
        await trx.query(sql);

        let result;
        try {
          result = await callback(trx);
        } catch (err) {
          sql.text = `ROLLBACK TO SAVEPOINT "${transactionId}"`;
          if (log) logData = log.beforeQuery(sql);
          await trx.query(sql);
          if (log) log.afterQuery(sql, logData);
          throw err;
        }

        sql.text = `RELEASE SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);
        await trx.query(sql);
        if (log) log.afterQuery(sql, logData);

        return result;
      } finally {
        trx.transactionId = transactionId - 1;
      }
    }
  }
}
