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
let options = defaultOptions;

const makeAdapters = (): Adapter[] => {
  return options.map(
    (config) => new AdapterClass({ driverAdapter: TestAdapter, config }),
  );
};

let adapters = makeAdapters();

let config: RakeDbConfig = testConfig;

let prepareDbTransactionPromise: Promise<void> | undefined;
let resolvePrepareDbTransaction: ((err: Error) => void) | undefined;
let arrangedAdapters: Adapter[] | undefined;

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
  config = {
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

  options = arg.options ?? defaultOptions;
  if (arg.schema) {
    options = options.map((opts) => ({ ...opts, schema: arg.schema }));
  }

  adapters = makeAdapters();
  arrangedAdapters = [...adapters];

  const { prepareDb } = arg;
  if (prepareDb) {
    await new Promise<void>((resolve) => {
      const adapter = adapters[0];
      prepareDbTransactionPromise = adapter
        .transaction(
          undefined,
          undefined,
          (trx) =>
            new Promise<void>(async (_, rejectTransaction) => {
              // `generate` will attempt to close the adapter, but we need to keep it open in the test
              trx.close = noop as () => Promise<void>;

              adapters[0] = trx;

              const db = createMigrationInterface(trx, true, config).getDb(
                config.columnTypes,
              );

              await prepareDb(db, true);

              resolve();

              resolvePrepareDbTransaction = rejectTransaction;
            }),
        )
        .catch((err) => {
          if (err !== rollbackError) {
            throw err;
          }
        });
    });
  }

  asMock(migrate).mockResolvedValue(adapters);

  if (arg.selects) {
    for (const select of arg.selects) {
      asMock(promptSelect).mockResolvedValueOnce(select);
    }
  }
};

const act = () => generate(adapters, config, []);

const assert = {
  migration(code?: string) {
    expect(asMock(fs.writeFile).mock.calls[0]?.[1]).toBe(code);
  },
  report(...logs: string[]) {
    const calls = asMock(config.logger?.log).mock.calls[0][0];
    expect(calls).toBe(logs.join('\n'));
  },
};

export const useGeneratorsTestUtils = () => {
  beforeEach(jest.clearAllMocks);

  afterEach(async () => {
    resolvePrepareDbTransaction?.(rollbackError);
    await Promise.all([
      prepareDbTransactionPromise,
      ...(arrangedAdapters?.map((x) => x.close()) ?? []),
    ]);
  });

  return {
    arrange,
    act,
    assert,
    defaultConfig: testConfig,
  };
};
