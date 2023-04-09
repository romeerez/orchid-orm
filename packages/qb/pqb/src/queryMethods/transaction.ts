import { Query } from '../query';
import { emptyArray, emptyObject } from 'orchid-core';

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

    const beginSql = {
      text: `BEGIN${options.level ? ` ISOLATION LEVEL ${options.level}` : ''}${
        options.readOnly !== undefined
          ? ` READ ${options.readOnly ? 'ONLY' : 'WRITE'}`
          : ''
      }${
        options.deferrable !== undefined
          ? ` ${options.deferrable ? '' : 'NOT '}DEFERRABLE`
          : ''
      }`,
      values: emptyArray,
    };

    const log = this.query.log;
    let logData: unknown | undefined;
    if (log) {
      logData = log.beforeQuery(beginSql);
    }

    const t = this.query.adapter.transaction(beginSql, (adapter) => {
      if (log) {
        log.afterQuery(beginSql, logData);
      }

      if (log) {
        logData = log.beforeQuery(commitSql);
      }

      return this.internal.transactionStorage.run(adapter, fn);
    });

    if (log) {
      t.then(
        () => log.afterQuery(commitSql, logData),
        () => log.afterQuery(rollbackSql, logData),
      );
    }

    return t;
  }
}
