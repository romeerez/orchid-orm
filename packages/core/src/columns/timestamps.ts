import {
  ColumnTypeBase,
  ColumnTypesBase,
  ColumnWithDefault,
  getDefaultNowFn,
} from './columnType';
import { pushOrNewArrayToObject } from '../utils';
import { snakeCaseKey } from './types';
import { isRawSQL, RawSQLBase } from '../raw';

type Timestamps<T extends ColumnTypeBase> = {
  createdAt: ColumnWithDefault<T, RawSQLBase>;
  updatedAt: ColumnWithDefault<T, RawSQLBase>;
};

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

class SimpleRawSQL extends RawSQLBase {
  columnTypes!: ColumnTypesBase;
  toSQL(): string {
    return this._sql as string;
  }
}

const raw = (sql: string) => new SimpleRawSQL(sql);

export const makeTimestampsHelpers = (
  updatedAtRegex: RegExp,
  quotedUpdatedAt: string,
  updatedAtRegexSnake: RegExp,
  quotedUpdatedAtSnakeCase: string,
) => {
  const addHookForUpdate = (now: string) => (q: unknown) => {
    const updatedAtInjector = makeInjector(
      updatedAtRegex,
      new SimpleRawSQL(`${quotedUpdatedAt} = ${now}`),
      'updatedAt',
    );

    pushOrNewArrayToObject(
      (q as { q: Record<string, (typeof updatedAtInjector)[]> }).q,
      'updateData',
      updatedAtInjector,
    );
  };

  const addHookForUpdateSnake = (now: string) => (q: unknown) => {
    const updatedAtInjectorSnake = makeInjector(
      updatedAtRegexSnake,
      raw(`${quotedUpdatedAtSnakeCase} = ${now}`),
      'updated_at',
    );

    pushOrNewArrayToObject(
      (q as { q: Record<string, (typeof updatedAtInjectorSnake)[]> }).q,
      'updateData',
      updatedAtInjectorSnake,
    );
  };

  return {
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
