import {
  DbSharedOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  Adapter,
  emptyArray,
  noop,
  AdapterClass,
} from 'pqb/internal';
import {
  ChangeCallback,
  promptSelect,
  createMigrationInterface,
  migrate,
  RakeDbConfig,
} from 'rake-db';
import {
  asMock,
  TestAdapter,
  testColumnTypes,
  testOrchidORM,
} from 'test-utils';
import { generate } from '../generate';
import fs from 'node:fs/promises';
import { testConfig } from '../../migrations.test-utils';
import { createTableFactory } from '../../../orm-table/table';

export const { defineTable, defineView, sql } = createTableFactory({
  columnTypes: testColumnTypes,
  snakeCase: true,
});

export type GeneratorTestDb = Parameters<
  ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>
>[0];

const defaultOptions = [
  {
    // use a separate db for every jest worker because schema changes in one test can block other tests
    databaseURL: `${process.env.PG_GENERATE_URL}-${process.env.JEST_WORKER_ID}`,
  },
];

/**
 * The state of one `arrange()` call, owned by its test.
 * Code of a timed-out test keeps running after the next test has started,
 * so every call keeps its own state instead of sharing module variables.
 */
interface Arranged {
  adapters: Adapter[];
  config: RakeDbConfig;
  teardown(): Promise<void>;
}

let arranged: Arranged | undefined;

const rollbackError = new Error('Rollback');

const arrange = async (arg: {
  config?: RakeDbConfig;
  options?: { databaseURL: string; schema?: string }[];
  tables?: unknown[];
  views?: unknown[];
  selects?: number[];
  dbOptions?: DbSharedOptions;
  prepareDb?: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>;
  schema?: string;
}) => {
  const config: RakeDbConfig = {
    dbPath: './db',
    ...(arg.config ?? testConfig),
    import: () =>
      Promise.resolve({
        db: testOrchidORM(
          {
            noPrimaryKey: 'ignore',
            ...arg.dbOptions,
            roles: arg.dbOptions?.roles
              ? // mention the role that always exists to omit it from the migrations
                [{ name: 'app-user' }, ...arg.dbOptions.roles]
              : undefined,
            generatorIgnore: {
              ...arg.dbOptions?.generatorIgnore,
              extensions: [
                ...(arg.dbOptions?.generatorIgnore?.extensions || emptyArray),
                'vector',
              ],
            },
            views: arg.views
              ? (Object.fromEntries(
                  arg.views.map((view, i) => [`view${i}`, view]),
                ) as never)
              : undefined,
          },
          arg.tables
            ? (Object.fromEntries(
                arg.tables.map((table, i) => [`table${i}`, table]),
              ) as never)
            : {},
        ),
      }),
  };

  const options = (arg.options ?? defaultOptions).map((opts) =>
    arg.schema ? { ...opts, schema: arg.schema } : opts,
  );

  const connections = options.map(
    (config) => new AdapterClass({ driverAdapter: TestAdapter, config }),
  );
  const adapters = [...connections];

  const prepared =
    arg.prepareDb && prepareDbInTransaction(adapters, config, arg.prepareDb);

  const current: Arranged = {
    adapters,
    config,
    async teardown() {
      try {
        await prepared?.rollback();
      } finally {
        await Promise.all(connections.map((x) => x.close()));
      }
    },
  };
  arranged = current;

  await prepared?.done;

  if (arranged !== current) {
    throw new Error('The test was torn down before `prepareDb` finished');
  }

  asMock(migrate).mockResolvedValue(adapters);

  if (arg.selects) {
    for (const select of arg.selects) {
      asMock(promptSelect).mockResolvedValueOnce(select);
    }
  }
};

/**
 * Runs `prepareDb` in a transaction of the first adapter and replaces that adapter with the transaction.
 * `done` settles when `prepareDb` finishes, rejecting with its error.
 * `rollback` can be called at any time: the transaction is rolled back once `prepareDb` finishes.
 */
const prepareDbInTransaction = (
  adapters: Adapter[],
  config: RakeDbConfig,
  prepareDb: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>,
) => {
  const prepared = Promise.withResolvers<void>();
  let isPrepared = false;
  const rolledBack = Promise.withResolvers<never>();
  // the transaction awaits it after `prepareDb`, the rejection can come before that
  rolledBack.promise.catch(noop);

  const transaction = adapters[0].transaction(
    undefined,
    undefined,
    async (trx) => {
      // `generate` will attempt to close the adapter, but we need to keep it open in the test
      trx.close = noop as () => Promise<void>;

      adapters[0] = trx;

      const db = createMigrationInterface(trx, true, config).getDb(
        config.columnTypes,
      );

      await prepareDb(db, true);

      isPrepared = true;
      prepared.resolve();

      await rolledBack.promise;
    },
  );

  return {
    done: Promise.race([prepared.promise, transaction]),
    rollback() {
      rolledBack.reject(rollbackError);
      return transaction.catch((err) => {
        // the test gets the errors that happen before `prepareDb` finishes from `done`
        if (err !== rollbackError && isPrepared) throw err;
      });
    },
  };
};

const getArranged = () => {
  if (!arranged) throw new Error('Call `arrange` before `act` and `assert`');
  return arranged;
};

const act = (args: string[] = []) => {
  const { adapters, config } = getArranged();
  return generate(adapters, config, args);
};

const assert = {
  migration(code?: string) {
    expect(asMock(fs.writeFile).mock.calls[0]?.[1]).toBe(code);
  },
  report(...logs: string[]) {
    const calls = asMock(getArranged().config.logger?.log).mock.calls[0][0];
    expect(calls).toBe(logs.join('\n'));
  },
};

export const useGeneratorsTestUtils = () => {
  const { isTTY } = process.stdin;

  beforeEach(() => {
    jest.clearAllMocks();
    // drop the answers that a failed test left unused
    asMock(promptSelect).mockReset();
    // answer the questions as in an interactive terminal, unless a test changes it
    process.stdin.isTTY = true;
  });

  afterAll(() => {
    process.stdin.isTTY = isTTY;
  });

  // teardown waits for `prepareDb` of a timed-out test, which can outlast the default hook timeout
  afterEach(async () => {
    const current = arranged;
    arranged = undefined;
    await current?.teardown();
  }, 30000);

  return {
    arrange,
    act,
    assert,
    defaultConfig: testConfig,
  };
};
