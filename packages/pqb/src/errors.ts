import { DatabaseError } from 'pg';

export class PormError extends Error {}

export class QueryError extends DatabaseError {
  get isUnique() {
    return this.code === '23505';
  }

  columnsCache?: Record<string, boolean>;
  get columns() {
    if (this.columnsCache) return this.columnsCache;

    const columns: Record<string, boolean> = {};

    if (this.detail) {
      const list = this.detail.match(/\((.*)\)=/)?.[1];
      if (list) {
        list.split(', ').forEach((column) => {
          columns[column.startsWith('"') ? column.slice(1, -1) : column] = true;
        });
      }
    }

    return (this.columnsCache = columns);
  }
}

export class NotFoundError extends PormError {
  constructor(message = 'Record is not found') {
    super(message);
  }
}

export class MoreThanOneRowError extends PormError {}

export class PormInternalError extends Error {}

export class UnhandledTypeError extends PormInternalError {
  constructor(value: never) {
    super(`Unhandled type: ${JSON.stringify(value)} received`);
  }
}
