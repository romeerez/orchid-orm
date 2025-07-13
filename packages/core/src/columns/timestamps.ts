import {
  ColumnTypeBase,
  ColumnWithDefault,
  getDefaultNowFn,
} from './columnType';
import { pushOrNewArrayToObjectImmutable, RecordUnknown } from '../utils';
import { RawSQLBase } from '../raw';

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

const makeTimestamps = <T extends ColumnTypeBase>(timestamp: () => T) => {
  const now = getDefaultNowFn();
  const nowRaw = raw(now);
  const updatedAt = timestamp().default(nowRaw);
  let updater:
    | ((data: (RecordUnknown | (() => void))[]) => RecordUnknown | undefined)
    | undefined;

  updatedAt.data.modifyQuery = (q: unknown, column: ColumnTypeBase) => {
    if (!updater) {
      const key = column.data.key;
      updater = (data) => {
        if (
          data.some((item) => {
            return typeof item !== 'function' && item[key];
          })
        )
          return;

        return { [column.data.key]: nowRaw };
      };
    }

    pushOrNewArrayToObjectImmutable(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).q,
      'updateData',
      updater,
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

export const timestampHelpers: TimestampHelpers = {
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
