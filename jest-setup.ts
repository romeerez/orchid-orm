import dotenv from 'dotenv';
import path from 'path';
import { Query, QueryData, RecordUnknown } from 'pqb';
import { skipQueryKeysForSubQuery } from './packages/pqb/src/sql/get-is-join-sub-query';
import { setPrepareSubQueryForSql } from './packages/pqb/src/columns/operators';

dotenv.config({ path: path.resolve(__dirname, '.env') });

jest.mock('orchid-orm', () => require('./packages/orm/src'), {
  virtual: true,
});

jest.mock('pqb', () => require('./packages/pqb/src'), {
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

jest.mock('rake-db', () => require('./packages/rake-db/src'), {
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

jest.mock('./packages/pqb/src/query/to-sql/sub-query-for-sql', () => {
  const mod = jest.requireActual(
    './packages/pqb/src/query/to-sql/sub-query-for-sql',
  );

  const result = {
    ...mod,
    prepareSubQueryForSql(...args: unknown[]) {
      const subQuery = args[1] as RecordUnknown;
      (subQuery.q as RecordUnknown).__subQueryBeforeHooksWhereCollected = true;
      return mod.prepareSubQueryForSql(...args);
    },
  };

  setPrepareSubQueryForSql(result.prepareSubQueryForSql);

  return result;
});

jest.mock('./packages/pqb/src/queryMethods/queryMethods.utils', () => {
  const mod = jest.requireActual(
    './packages/pqb/src/queryMethods/queryMethods.utils',
  );

  return {
    ...mod,
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

      return mod.queryWrap(...args);
    },
    cloneQueryBaseUnscoped(query: RecordUnknown) {
      const { __subQueryBeforeHooksWhereCollected } = query.q as RecordUnknown;
      const cloned = mod.cloneQueryBaseUnscoped(query);
      cloned.q.__subQueryBeforeHooksWhereCollected =
        __subQueryBeforeHooksWhereCollected;
      return cloned;
    },
  };
});

jest.mock('./packages/pqb/src/sql/to-sql', () => {
  const mod = jest.requireActual('./packages/pqb/src/sql/to-sql');
  const { toSql } = mod;
  return {
    ...mod,
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
        // TODO: in a nested `with` with insert there is cteName but it still needs to move the query
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
  './packages/pqb/src/query/cte/move-mutative-query-to-cte-base.sql',
  () => {
    const mod = jest.requireActual(
      './packages/pqb/src/query/cte/move-mutative-query-to-cte-base.sql',
    );
    return {
      ...mod,
      moveQueryToCte(...args: unknown[]) {
        const q = (args[1] as { q: RecordUnknown }).q;
        q.__consideredMovingSubQueryToCte = true;
        return mod.moveQueryToCte(...args);
      },
      moveMutativeQueryToCteBase(...args: unknown[]) {
        const q = (args[1] as { q: RecordUnknown }).q;
        q.__consideredMovingSubQueryToCte = true;
        return mod.moveMutativeQueryToCteBase(...args);
      },
    };
  },
);

skipQueryKeysForSubQuery.__subQueryBeforeHooksWhereCollected =
  skipQueryKeysForSubQuery.__consideredMovingSubQueryToCte = true;
