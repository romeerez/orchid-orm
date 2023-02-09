import { Query } from '../query';

const beginSql = {
  text: 'BEGIN',
  values: [],
};

const commitSql = {
  text: 'COMMIT',
  values: [],
};

const rollbackSql = {
  text: 'ROLLBACK',
  values: [],
};

export class Transaction {
  async transaction<T extends Query, Result>(
    this: T,
    cb: (query: T) => Promise<Result>,
  ): Promise<Result> {
    const log = this.query.log;
    let logData: unknown | undefined;
    if (log) {
      logData = log.beforeQuery(beginSql);
    }
    const t = this.query.adapter.transaction((adapter) => {
      if (log) {
        log.afterQuery(beginSql, logData);
      }

      const q = this.clone();
      q.query.adapter = adapter;
      q.query.inTransaction = true;

      if (log) {
        logData = log.beforeQuery(commitSql);
      }
      return cb(q);
    });

    if (log) {
      t.then(
        () => {
          log.afterQuery(commitSql, logData);
        },
        () => {
          log.afterQuery(rollbackSql, logData);
        },
      );
    }

    return t;
  }

  transacting<T extends Query>(this: T, query: Query): T {
    return this.clone()._transacting(query);
  }

  _transacting<T extends Query>(this: T, query: Query): T {
    this.query.adapter = query.query.adapter;
    this.query.inTransaction = true;
    return this;
  }
}
