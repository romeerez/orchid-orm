import { Query } from '../query';
import { PostgresAdapter } from '../adapter';

export class Transaction {
  // TODO: pass this to callback
  async transaction<T extends { adapter: PostgresAdapter }, Result>(
    this: T,
    cb: (query: { adapter: PostgresAdapter }) => Promise<Result>,
  ): Promise<Result> {
    return this.adapter.transaction((adapter) => cb({ adapter }));
  }

  transacting<T extends Query>(
    this: T,
    query: { adapter: PostgresAdapter },
  ): T {
    return this.clone()._transacting(query);
  }

  _transacting<T extends Query>(
    this: T,
    query: { adapter: PostgresAdapter },
  ): T {
    this.adapter = query.adapter;
    return this;
  }
}
