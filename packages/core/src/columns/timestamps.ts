import { getRawSql, isRaw, raw, RawExpression } from '../raw';
import {
  ColumnTypeBase,
  ColumnWithDefault,
  getDefaultNowFn,
} from './columnType';
import { pushOrNewArrayToObject } from '../utils';
import { snakeCaseKey } from './types';

type Timestamps<T extends ColumnTypeBase> = {
  createdAt: ColumnWithDefault<T, RawExpression>;
  updatedAt: ColumnWithDefault<T, RawExpression>;
};

const makeInjector =
  (updatedAtRegex: RegExp, updateUpdatedAtItem: RawExpression, key: string) =>
  (data: (RawExpression | Record<string, unknown> | (() => void))[]) => {
    const alreadyUpdatesUpdatedAt = data.some((item) => {
      if (isRaw(item)) {
        updatedAtRegex.lastIndex = 0;
        const sql = getRawSql(item);
        return updatedAtRegex.test(
          typeof sql === 'string'
            ? sql
            : (sql[0] as unknown as string[]).join(''),
        );
      } else {
        return typeof item !== 'function' && item[key];
      }
    });

    return alreadyUpdatesUpdatedAt ? undefined : updateUpdatedAtItem;
  };

export const makeTimestampsHelpers = (
  updatedAtRegex: RegExp,
  quotedUpdatedAt: string,
  updatedAtRegexSnake: RegExp,
  quotedUpdatedAtSnakeCase: string,
) => {
  const addHookForUpdate = (now: string) => (q: unknown) => {
    const updatedAtInjector = makeInjector(
      updatedAtRegex,
      raw(`${quotedUpdatedAt} = ${now}`),
      'updatedAt',
    );

    pushOrNewArrayToObject(
      (q as { query: Record<string, (typeof updatedAtInjector)[]> }).query,
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
      (q as { query: Record<string, (typeof updatedAtInjectorSnake)[]> }).query,
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
