import { Query } from '../query';
import { PostgresAdapter } from '../adapter';

export type TransactionMethod = <T extends Query, Result>(
  this: T,
  cb: (adapter: PostgresAdapter) => Promise<Result>,
) => Promise<Result>;

export class Transaction {
  async transaction<T extends Query, Result>(
    this: T,
    cb: (adapter: PostgresAdapter) => Promise<Result>,
  ): Promise<Result> {
    return this.adapter.transaction(cb);
  }

  transacting<T extends Query>(this: T, trx: PostgresAdapter): T {
    return this.clone()._transacting(trx);
  }

  _transacting<T extends Query>(this: T, trx: PostgresAdapter): T {
    this.adapter = trx;
    return this;
  }
}
