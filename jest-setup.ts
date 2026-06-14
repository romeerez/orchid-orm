import dotenv from 'dotenv';
import * as timers from 'node:timers';
import path from 'path';
import { QueryData, RecordUnknown } from './packages/pqb/src/internal';
import { skipQueryKeysForSubQuery } from './packages/pqb/src/query/sql/get-is-join-sub-query';
import { setPrepareSubQueryForSql } from './packages/pqb/src/columns/operators';
import { setRawSqlPrepareSubQueryForSql } from './packages/pqb/src/query/expressions/raw-sql';

/**
 * Workaround for Bun SQL:
 * Bun SQL returns timestamps as Date-like objects, they are not `instanceof Date`.
 */
const isBun = process.env.ADAPTER === 'bun';
const originalExpectAny = expect.any;
expect.any = (cls: unknown) => {
  if (isBun && cls === Date) {
    return {
      ...originalExpectAny(cls),
      asymmetricMatch(value: unknown) {
        return Object.prototype.toString.call(value) === '[object Date]';
      },
    };
  }
  return originalExpectAny(cls);
};

const ensureTimerGlobal = (
  key: 'setTimeout' | 'clearTimeout' | 'setImmediate' | 'clearImmediate',
) => {
  if (typeof globalThis[key] === 'function') {
    return;
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: timers[key],
  });
};

ensureTimerGlobal('setTimeout');
ensureTimerGlobal('clearTimeout');
ensureTimerGlobal('setImmediate');
ensureTimerGlobal('clearImmediate');

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Jest bloats error traces (starting from v30) with virtual module loader entries
// and in some cases it's not enough to find the origin, therefore maxing out the limit
Error.stackTraceLimit = 1000;

jest.mock('timers/promises', () => ({
  setTimeout: jest.fn(),
}));

jest.mock('orchid-orm', () => require('./packages/orm/src'), {
  virtual: true,
});

jest.mock(
  'orchid-orm/postgres-js',
  () => require('./packages/orm/src/adapters/postgres-js'),
  {
    virtual: true,
  },
);

jest.mock('orchid-orm/bun', () => require('./packages/orm/src/adapters/bun'), {
  virtual: true,
});

jest.mock(
  'orchid-orm/node-postgres',
  () => require('./packages/orm/src/adapters/node-postgres'),
  {
    virtual: true,
  },
);

jest.mock('pqb', () => require('./packages/pqb/src/public'), {
  virtual: true,
});

jest.mock('pqb/internal', () => require('./packages/pqb/src/internal'), {
  virtual: true,
});

jest.mock(
  'pqb/node-postgres',
  () => require('./packages/pqb/src/adapters/node-postgres'),
  {
    virtual: true,
  },
);

jest.mock(
  'pqb/postgres-js',
  () => require('./packages/pqb/src/adapters/postgres-js'),
  {
    virtual: true,
  },
);

jest.mock('pqb/bun', () => require('./packages/pqb/src/adapters/bun'), {
  virtual: true,
});

jest.mock('rake-db', () => require('./packages/rake-db/src'), {
  virtual: true,
});

jest.mock('rake-db/bun', () => require('./packages/rake-db/src/adapters/bun'), {
  virtual: true,
});

jest.mock(
  'orchid-orm-schema-to-zod',
  () => require('./packages/schemaConfigs/zod/src'),
  {
    virtual: true,
  },
);

jest.mock(
  'orchid-orm-valibot',
  () => require('./packages/schemaConfigs/valibot/src'),
  {
    virtual: true,
  },
);

jest.mock('test-utils', () => require('./packages/test-utils/src'), {
  virtual: true,
});

// Deep freeze ORM tables: prevent columns, relations, table data (indexes, constraints, etc.) from being mutated.
// Cannot freeze instances of classes because `const cloned = Object.create(orig); cloned.data = {...}`
// doesn't work when `orig` is frozen and already has `data`.
jest.mock('./packages/orm/src/orm-table/base-table', () => {
  const actual = jest.requireActual('./packages/orm/src/orm-table/base-table');

  const excludeKeys = new Set([
    'prototype',
    'inputSchema',
    'outputSchema',
    'querySchema',
    'createSchema',
    'updateSchema',
    'pkeySchema',
  ]);

  const deepFreeze = <T>(arg: T, visited = new WeakSet<object>()): T => {
    if (!arg || typeof arg !== 'object') {
      return arg;
    }

    const target = arg as object;

    if (visited.has(target)) {
      return arg;
    }
    visited.add(target);

    for (const key of Object.getOwnPropertyNames(target)) {
      if (excludeKeys.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (!descriptor || !('value' in descriptor)) {
        continue;
      }

      const value = descriptor.value;
      if (value && typeof value === 'object') {
        deepFreeze(value, visited);
      }
    }

    return arg.constructor === Object ? Object.freeze(arg) : arg;
  };

  return {
    ...actual,
    createBaseTable(options: unknown) {
      const baseTable = actual.createBaseTable(options);
      const { instance } = baseTable;
      baseTable.instance = function () {
        return deepFreeze(instance.call(this));
      };
      return baseTable;
    },
  };
});

jest.mock('./packages/pqb/src/utils', () => {
  const actual = jest.requireActual('./packages/pqb/src/utils');
  return process.env.RUNNING_BENCHMARKS
    ? actual
    : {
        ...actual,
        getStackTrace: jest.fn(() => {
          const result = actual.getStackTrace();
          return result.filter((file: { getFileName(): string | null }) => {
            const fileName = file.getFileName();
            return (
              fileName &&
              fileName !== __filename &&
              !fileName.includes('jest-mock')
            );
          });
        }),
        getCallerFilePath: jest.fn(() => 'path'),
      };
});

jest.mock(
  './packages/pqb/src/query/internal-features/sub-query/sub-query-for-sql',
  () => {
    const actual = jest.requireActual(
      './packages/pqb/src/query/internal-features/sub-query/sub-query-for-sql',
    );

    if (process.env.RUNNING_BENCHMARKS) {
      return actual;
    }

    const result = {
      ...actual,
      prepareSubQueryForSql(...args: unknown[]) {
        const subQuery = args[1] as RecordUnknown;
        (subQuery.q as RecordUnknown).__subQueryBeforeHooksWhereCollected =
          true;
        return actual.prepareSubQueryForSql(...args);
      },
    };

    setPrepareSubQueryForSql(result.prepareSubQueryForSql);
    setRawSqlPrepareSubQueryForSql(result.prepareSubQueryForSql);

    return result;
  },
);

jest.mock('./packages/pqb/src/query/basic-features/wrap/wrap', () => {
  const actual = jest.requireActual(
    './packages/pqb/src/query/basic-features/wrap/wrap',
  );

  return process.env.RUNNING_BENCHMARKS
    ? actual
    : {
        ...actual,
        queryWrap(...args: unknown[]) {
          const outerQuery = args[0] as { q: RecordUnknown };
          const innerQuery = args[1] as { q: RecordUnknown };
          if (innerQuery.q.__subQueryBeforeHooksWhereCollected) {
            outerQuery.q.__subQueryBeforeHooksWhereCollected = true;
          } else if (
            // special case for `pluck` sub query when it's wrapped in json in select
            outerQuery.q.returnType === 'pluck' &&
            outerQuery.q.__subQueryBeforeHooksWhereCollected
          ) {
            innerQuery.q.__subQueryBeforeHooksWhereCollected = true;
          }

          return actual.queryWrap(...args);
        },
        cloneQueryBaseUnscoped(query: RecordUnknown) {
          const { __subQueryBeforeHooksWhereCollected } =
            query.q as RecordUnknown;
          const cloned = actual.cloneQueryBaseUnscoped(query);
          cloned.q.__subQueryBeforeHooksWhereCollected =
            __subQueryBeforeHooksWhereCollected;
          return cloned;
        },
      };
});

jest.mock('./packages/pqb/src/query/sql/to-sql', () => {
  const actual = jest.requireActual('./packages/pqb/src/query/sql/to-sql');
  const { toSql } = actual;
  return process.env.RUNNING_BENCHMARKS
    ? actual
    : {
        ...actual,
        toSql(...args: unknown[]) {
          const q = (args[0] as unknown as { q: RecordUnknown }).q;

          const topCtx = args[2] as { q: QueryData };
          if (topCtx) {
            if (
              !q.__subQueryBeforeHooksWhereCollected &&
              q.type !== 'upsert' && // upsert handles before hooks on its own
              // toSql is called only for a dedup key in join lateral
              !(
                (q.returnType === 'value' || q.returnType === 'valueOrThrow') &&
                (q.select as RecordUnknown)?.length === 0
              ) &&
              // ignore the case when to-sql-ing the main union query,
              // the before hooks are already in the main query.
              !(topCtx.q.union?.b.q === (q as unknown as QueryData))
            ) {
              throw new Error(
                'Sub query was not processed by prepareSubQueryForSql',
              );
            }

            const cteName = args[4];
            if (topCtx && !cteName && !q.__consideredMovingSubQueryToCte) {
              throw new Error(
                'Sub query was not processed by moveQueryToCte or moveMutativeQueryToCteBase',
              );
            }
          }

          return toSql(...args);
        },
      };
});

jest.mock(
  './packages/pqb/src/query/basic-features/cte/move-mutative-query-to-cte-base.sql',
  () => {
    const actual = jest.requireActual(
      './packages/pqb/src/query/basic-features/cte/move-mutative-query-to-cte-base.sql',
    );
    return process.env.RUNNING_BENCHMARKS
      ? actual
      : {
          ...actual,
          moveQueryToCte(...args: unknown[]) {
            const q = (args[1] as { q: RecordUnknown }).q;
            q.__consideredMovingSubQueryToCte = true;
            return actual.moveQueryToCte(...args);
          },
          moveMutativeQueryToCteBase(...args: unknown[]) {
            const q = (args[2] as { q: RecordUnknown }).q;
            q.__consideredMovingSubQueryToCte = true;
            return actual.moveMutativeQueryToCteBase(...args);
          },
        };
  },
);

jest.mock('./packages/pqb/src/query/basic-features/cte/cte.query', () => {
  const actual = jest.requireActual(
    './packages/pqb/src/query/basic-features/cte/cte.query',
  );
  return process.env.RUNNING_BENCHMARKS
    ? actual
    : {
        ...actual,
        _with(...args: unknown[]) {
          (args[2] as { q: RecordUnknown }).q.__consideredMovingSubQueryToCte =
            true;
          return actual._with(...args);
        },
      };
});

if (!process.env.RUNNING_BENCHMARKS) {
  skipQueryKeysForSubQuery.__subQueryBeforeHooksWhereCollected =
    skipQueryKeysForSubQuery.__consideredMovingSubQueryToCte = true;
}
