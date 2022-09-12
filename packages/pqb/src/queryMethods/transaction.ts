import { Query } from '../query';

export class Transaction {
  async transaction<T extends Query, Result>(
    this: T,
    cb: (query: T) => Promise<Result>,
  ): Promise<Result> {
    return this.query.adapter.transaction((adapter) => {
      const q = this.clone();
      q.query.adapter = adapter;
      return cb(q);
    });
  }

  transacting<T extends Query>(this: T, query: Query): T {
    return this.clone()._transacting(query);
  }

  _transacting<T extends Query>(this: T, query: Query): T {
    this.query.adapter = query.query.adapter;
    return this;
  }
}
