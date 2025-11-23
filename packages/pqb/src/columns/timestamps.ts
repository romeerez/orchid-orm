import { pushOrNewArrayToObjectImmutable, RecordUnknown } from '../core/utils';
import { RawSQLBase } from '../core/raw';
import { Column, getDefaultNowFn } from './column';

// Column types returned by `...t.timestamps()` and variations.
export interface Timestamps<T extends Column.Pick.Data> {
  // Timestamp column with a `now()` default
  createdAt: Column.Modifiers.Default<T, RawSQLBase>;
  // Timestamp column with a `now()` default, and it's being updated on every record update.
  updatedAt: Column.Modifiers.Default<T, RawSQLBase>;
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
  timestamps<T extends Column.Pick.Data>(this: {
    timestamp(): T;
  }): Timestamps<T>;

  /**
   * The same as {@link timestamps}, for the timestamp without time zone time.
   */
  timestampsNoTZ<T extends Column.Pick.Data>(this: {
    timestampNoTZ(): T;
  }): Timestamps<T>;
}

const makeTimestamps = <T extends Column.Pick.Data>(timestamp: () => T) => {
  const now = getDefaultNowFn();
  const nowRaw = raw(now);
  const updatedAt = (timestamp() as unknown as Column).default(nowRaw);
  let updater:
    | ((data: (RecordUnknown | (() => void))[]) => RecordUnknown | undefined)
    | undefined;

  updatedAt.data.modifyQuery = (q: unknown, column: Column.Pick.Data) => {
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

  const createdAt = (timestamp() as unknown as Column).default(nowRaw);
  createdAt.data.defaultTimestamp = 'createdAt';

  return {
    createdAt,
    updatedAt,
  } as Timestamps<T>;
};

export const timestampHelpers: TimestampHelpers = {
  timestamps<T extends Column.Pick.Data>(this: {
    timestamp(): T;
  }): Timestamps<T> {
    return makeTimestamps(this.timestamp);
  },

  timestampsNoTZ<T extends Column.Pick.Data>(this: {
    timestampNoTZ(): T;
  }): Timestamps<T> {
    return makeTimestamps(this.timestampNoTZ);
  },
};
