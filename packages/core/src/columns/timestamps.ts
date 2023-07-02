import {
  ColumnTypeBase,
  ColumnTypesBase,
  ColumnWithDefault,
  getDefaultNowFn,
} from './columnType';
import { pushOrNewArrayToObject } from '../utils';
import { snakeCaseKey } from './types';
import { isRawSQL, RawSQLBase } from '../raw';

// Column types returned by `...t.timestamps()` and variations.
type Timestamps<T extends ColumnTypeBase> = {
  // Timestamp column with a `now()` default
  createdAt: ColumnWithDefault<T, RawSQLBase>;
  // Timestamp column with a `now()` default, and it's being updated on every record update.
  updatedAt: ColumnWithDefault<T, RawSQLBase>;
};

// Builds a function which is triggered on every update of records.
// It tries to find if `updatedAt` column is being updated with a user-provided value.
// And if there is no value for `updatedAt`, it is setting the new value for it.
const makeInjector =
  (updatedAtRegex: RegExp, updateUpdatedAtItem: RawSQLBase, key: string) =>
  (data: (RawSQLBase | Record<string, unknown> | (() => void))[]) => {
    const alreadyUpdatesUpdatedAt = data.some((item) => {
      if (isRawSQL(item)) {
        updatedAtRegex.lastIndex = 0;
        return updatedAtRegex.test(
          typeof item._sql === 'string'
            ? item._sql
            : (item._sql[0] as unknown as string[]).join(''),
        );
      } else {
        return typeof item !== 'function' && item[key];
      }
    });

    return alreadyUpdatesUpdatedAt ? undefined : updateUpdatedAtItem;
  };

// Simplified SQL type that returns raw SQL as it is, without dealing with SQL variables.
class SimpleRawSQL extends RawSQLBase {
  columnTypes!: ColumnTypesBase;
  toSQL(): string {
    return this._sql as string;
  }
}

// Construct a simplified raw SQL.
const raw = (sql: string) => new SimpleRawSQL(sql);

// Build `timestamps`, `timestampsNoTZ`, and similar helpers.
export const makeTimestampsHelpers = (
  // Regular expression to search for setting of the `updatedAt` timestamp in a raw SQL.
  updatedAtRegex: RegExp,
  // Quoted `updatedAt` column name.
  quotedUpdatedAt: string,
  // Regular expression to search for setting of the `updated_at` timestamp in a raw SQL.
  updatedAtRegexSnake: RegExp,
  // Quoted `updated_at` column name.
  quotedUpdatedAtSnakeCase: string,
) => {
  // builds a function to modify a query object of a specific table where timestamps are defined in.
  const addHookForUpdate = (now: string) => (q: unknown) => {
    const updatedAtInjector = makeInjector(
      updatedAtRegex,
      new SimpleRawSQL(`${quotedUpdatedAt} = ${now}`),
      'updatedAt',
    );

    // push a function to the query to search for existing timestamp and add a new timestamp value if it's not set in the update.
    pushOrNewArrayToObject(
      (q as { q: Record<string, (typeof updatedAtInjector)[]> }).q,
      'updateData',
      updatedAtInjector,
    );
  };

  // builds a function to modify a query object of a specific table where snake case timestamps are defined in.
  const addHookForUpdateSnake = (now: string) => (q: unknown) => {
    const updatedAtInjectorSnake = makeInjector(
      updatedAtRegexSnake,
      raw(`${quotedUpdatedAtSnakeCase} = ${now}`),
      'updated_at',
    );

    // push a function to the query to search for existing timestamp and add a new timestamp value if it's not set in the update.
    pushOrNewArrayToObject(
      (q as { q: Record<string, (typeof updatedAtInjectorSnake)[]> }).q,
      'updateData',
      updatedAtInjectorSnake,
    );
  };

  return {
    /**
     * Add `createdAt` and `updatedAt timestamps. Both have `now()` as a default, `updatedAt` is automatically updated during update.
     */
    timestamps<T extends ColumnTypeBase>(this: {
      name(name: string): { timestamp(): T };
      timestamp(): T;
      timestampsSnakeCase(): Timestamps<T>;
    }): Timestamps<T> {
      if ((this as { [snakeCaseKey]?: boolean })[snakeCaseKey])
        return this.timestampsSnakeCase();

      const now = getDefaultNowFn();
      const nowRaw = raw(now);
      const updatedAt = this.timestamp().default(nowRaw);
      updatedAt.data.modifyQuery = addHookForUpdate(now);

      return {
        createdAt: this.timestamp().default(nowRaw),
        updatedAt,
      };
    },
    /**
     * The same as {@link timestamps}, but for `created_at` and `updated_at` database columns.
     */
    timestampsSnakeCase<T extends ColumnTypeBase>(this: {
      name(name: string): { timestamp(): T };
      timestamp(): T;
    }): Timestamps<T> {
      const now = getDefaultNowFn();
      const nowRaw = raw(now);
      const updatedAt = this.name('updated_at').timestamp().default(nowRaw);
      updatedAt.data.modifyQuery = addHookForUpdateSnake(now);

      return {
        createdAt: this.name('created_at').timestamp().default(nowRaw),
        updatedAt,
      };
    },
    /**
     * The same as {@link timestamps}, for the timestamp without time zone time.
     */
    timestampsNoTZ<T extends ColumnTypeBase>(this: {
      name(name: string): { timestampNoTZ(): T };
      timestampNoTZ(): T;
      timestampsNoTZSnakeCase(): Timestamps<T>;
    }): Timestamps<T> {
      if ((this as { [snakeCaseKey]?: boolean })[snakeCaseKey])
        return this.timestampsNoTZSnakeCase();

      const now = getDefaultNowFn();
      const nowRaw = raw(now);
      const updatedAt = this.timestampNoTZ().default(nowRaw);
      updatedAt.data.modifyQuery = addHookForUpdate(now);

      return {
        createdAt: this.timestampNoTZ().default(nowRaw),
        updatedAt,
      };
    },
    /**
     * The same as {@link timestamps}, for the timestamp without time zone time and with snake cased names.
     */
    timestampsNoTZSnakeCase<T extends ColumnTypeBase>(this: {
      name(name: string): { timestampNoTZ(): T };
      timestampNoTZ(): T;
    }): Timestamps<T> {
      const now = getDefaultNowFn();
      const nowRaw = raw(now);
      const updatedAt = this.name('updated_at').timestampNoTZ().default(nowRaw);
      updatedAt.data.modifyQuery = addHookForUpdateSnake(now);

      return {
        createdAt: this.name('created_at').timestampNoTZ().default(nowRaw),
        updatedAt,
      };
    },
  };
};
