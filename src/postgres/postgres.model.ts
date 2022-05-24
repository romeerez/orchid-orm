import { PostgresAdapter } from './postgres.orm';
import { RelationThunks } from './postgres.relations';

export class PostgresModel<T = unknown> {
  constructor(public adapter: PostgresAdapter) {
  }

  all() {
    return [] as T[]
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel<unknown>;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
