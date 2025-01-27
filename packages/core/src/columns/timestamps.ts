import {
  ColumnTypeBase,
  ColumnWithDefault,
  getDefaultNowFn,
} from './columnType';
import { pushOrNewArrayToObjectImmutable, RecordUnknown } from '../utils';
import { isRawSQL, RawSQLBase } from '../raw';

// Column types returned by `...t.timestamps()` and variations.
export interface Timestamps<T extends ColumnTypeBase> {
  // Timestamp column with a `now()` default
  createdAt: ColumnWithDefault<T, RawSQLBase>;
  // Timestamp column with a `now()` default, and it's being updated on every record update.
  updatedAt: ColumnWithDefault<T, RawSQLBase>;
}

// Simplified SQL type that returns raw SQL as it is, without dealing with SQL variables.
class SimpleRawSQL extends RawSQLBase {
  // Column types are stored to be passed to the `type` callback.
  columnTypes!: unknown;

  // Simply returning SQL provided in the constructor.
  makeSQL(): string {
    return this._sql as string;
  }
}

// Construct a simplified raw SQL.
const raw = (sql: string) => new SimpleRawSQL(sql);

export interface TimestampHelpers {
  /**
   * Add `createdAt` and `updatedAt` timestamps. Both have `now()` as a default, `updatedAt` is automatically updated during update.
   */
  timestamps<T extends ColumnTypeBase>(this: { timestamp(): T }): Timestamps<T>;

  /**
   * The same as {@link timestamps}, for the timestamp without time zone time.
   */
  timestampsNoTZ<T extends ColumnTypeBase>(this: {
    timestampNoTZ(): T;
  }): Timestamps<T>;
}

// Build `timestamps`, `timestampsNoTZ`, and similar helpers.
export const makeTimestampsHelpers = (
  makeRegexToFindInSql: (s: string) => RegExp,
): TimestampHelpers => {
  const makeTimestamps = <T extends ColumnTypeBase>(timestamp: () => T) => {
    const now = getDefaultNowFn();
    const nowRaw = raw(now);
    const updatedAt = timestamp().default(nowRaw);
    let updatedAtInjector:
      | ((
          data: (RawSQLBase | RecordUnknown | (() => void))[],
        ) => SimpleRawSQL | undefined)
      | undefined;

    updatedAt.data.modifyQuery = (q: unknown, column: ColumnTypeBase) => {
      if (!updatedAtInjector) {
        const key = column.data.key;
        const name = column.data.name ?? key;
        const nowSql = new SimpleRawSQL(`"${name}" = ${now}`);

        const updatedAtRegex = makeRegexToFindInSql(`\\b${name}\\b"?\\s*=`);

        // A function which is triggered on every update of records.
        // It tries to find if `updatedAt` column is being updated with a user-provided value.
        // And if there is no value for `updatedAt`, it is setting the new value for it.
        updatedAtInjector = (
          data: (RawSQLBase | RecordUnknown | (() => void))[],
        ) => {
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

          return alreadyUpdatesUpdatedAt ? undefined : nowSql;
        };
      }

      // push a function to the query to search for existing timestamp and add a new timestamp value if it's not set in the update.
      pushOrNewArrayToObjectImmutable(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q as any).q,
        'updateData',
        updatedAtInjector,
      );
    };
    updatedAt.data.defaultTimestamp = 'updatedAt';

    const createdAt = timestamp().default(nowRaw);
    createdAt.data.defaultTimestamp = 'createdAt';

    return {
      createdAt,
      updatedAt,
    };
  };

  return {
    timestamps<T extends ColumnTypeBase>(this: {
      timestamp(): T;
    }): Timestamps<T> {
      return makeTimestamps(this.timestamp);
    },

    timestampsNoTZ<T extends ColumnTypeBase>(this: {
      timestampNoTZ(): T;
    }): Timestamps<T> {
      return makeTimestamps(this.timestampNoTZ);
    },
  };
};
