import { getRawSql, isRaw, raw, RawExpression } from '../raw';
import { ColumnTypeBase, ColumnWithDefault } from './columnType';
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
        return updatedAtRegex.test(getRawSql(item));
      } else {
        return typeof item !== 'function' && item[key];
      }
    });

    return alreadyUpdatesUpdatedAt ? undefined : updateUpdatedAtItem;
  };

export const makeTimestampsHelpers = (
  updatedAtRegex: RegExp,
  updateUpdatedAtItem: RawExpression,
  updatedAtRegexSnake: RegExp,
  updateUpdatedAtItemSnake: RawExpression,
) => {
  const updatedAtInjector = makeInjector(
    updatedAtRegex,
    updateUpdatedAtItem,
    'updatedAt',
  );

  const addHookForUpdate = (q: unknown) => {
    pushOrNewArrayToObject(
      (q as { query: Record<string, (typeof updatedAtInjector)[]> }).query,
      'updateData',
      updatedAtInjector,
    );
  };

  const updatedAtInjectorSnake = makeInjector(
    updatedAtRegexSnake,
    updateUpdatedAtItemSnake,
    'updated_at',
  );

  const addHookForUpdateSnake = (q: unknown) => {
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

      const updatedAt = this.timestamp().default(raw('now()'));
      updatedAt.data.modifyQuery = addHookForUpdate;

      return {
        createdAt: this.timestamp().default(raw('now()')),
        updatedAt,
      };
    },
    timestampsSnakeCase<T extends ColumnTypeBase>(this: {
      name(name: string): { timestamp(): T };
      timestamp(): T;
    }): Timestamps<T> {
      const updatedAt = this.name('updated_at')
        .timestamp()
        .default(raw('now()'));
      updatedAt.data.modifyQuery = addHookForUpdateSnake;

      return {
        createdAt: this.name('created_at').timestamp().default(raw('now()')),
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

      const updatedAt = this.timestampNoTZ().default(raw('now()'));
      updatedAt.data.modifyQuery = addHookForUpdate;

      return {
        createdAt: this.timestampNoTZ().default(raw('now()')),
        updatedAt,
      };
    },
    timestampsNoTZSnakeCase<T extends ColumnTypeBase>(this: {
      name(name: string): { timestampNoTZ(): T };
      timestampNoTZ(): T;
    }): Timestamps<T> {
      const updatedAt = this.name('updated_at')
        .timestampNoTZ()
        .default(raw('now()'));
      updatedAt.data.modifyQuery = addHookForUpdateSnake;

      return {
        createdAt: this.name('created_at')
          .timestampNoTZ()
          .default(raw('now()')),
        updatedAt,
      };
    },
  };
};
