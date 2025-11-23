import {
  DbSharedOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  TableDataFn,
  TableDataItem,
  AdapterBase,
  ColumnsShape,
  emptyArray,
  MaybeArray,
  noop,
} from 'pqb';
import {
  ChangeCallback,
  promptSelect,
  AnyRakeDbConfig,
  createMigrationInterface,
  migrate,
} from 'rake-db';
import {
  asMock,
  TestAdapter,
  testColumnTypes,
  testOrchidORM,
} from 'test-utils';
import { generate } from '../generate';
import fs from 'fs/promises';
import { testConfig } from '../../migrations.test-utils';
import { createBaseTable } from '../../../baseTable';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
  snakeCase: true,
});

const defaultOptions = [
  {
    // use a separate db for every jest worker because schema changes in one test can block other tests
    databaseURL: `${process.env.PG_GENERATE_URL}-${process.env.JEST_WORKER_ID}`,
  },
];
let options = defaultOptions;

const makeAdapters = (): AdapterBase[] => {
  return options.map((opts) => new TestAdapter(opts));
};

let adapters = makeAdapters();

let config: AnyRakeDbConfig = testConfig;

let prepareDbTransactionPromise: Promise<void> | undefined;
let resolvePrepareDbTransaction: ((err: Error) => void) | undefined;
let arrangedAdapters: AdapterBase[] | undefined;

const rollbackError = new Error('Rollback');

const arrange = async (arg: {
  config?: AnyRakeDbConfig;
  options?: { databaseURL: string }[];
  tables?: (typeof BaseTable)[];
  selects?: number[];
  dbOptions?: DbSharedOptions;
  prepareDb?: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>;
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
            generatorIgnore: {
              ...arg.dbOptions?.generatorIgnore,
              extensions: [
                ...(arg.dbOptions?.generatorIgnore?.extensions || emptyArray),
                'vector',
              ],
            },
          },
          arg.tables
            ? Object.fromEntries(arg.tables.map((klass) => [klass.name, klass]))
            : {},
        ),
      }),
  };

  options = arg.options ?? defaultOptions;

  adapters = makeAdapters();
  arrangedAdapters = [...adapters];

  const { prepareDb } = arg;
  if (prepareDb) {
    await new Promise<void>((resolve) => {
      const adapter = adapters[0];
      prepareDbTransactionPromise = adapter
        .transaction(
          undefined,
          (trx) =>
            new Promise<void>(async (_, rejectTransaction) => {
              // `generate` will attempt to close the adapter, but we need to keep it open in the test
              trx.close = noop as () => Promise<void>;

              adapters[0] = trx;

              const db = createMigrationInterface<
                DefaultColumnTypes<DefaultSchemaConfig>
              >(trx, true, config);

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

const table = <Shape extends ColumnsShape.Base>(
  columns?: (t: typeof BaseTable.columnTypes) => Shape,
  dataFn?: TableDataFn<Shape, MaybeArray<TableDataItem>>,
  options?: { noPrimaryKey?: boolean; name?: string; schema?: string },
) => {
  return class Table extends BaseTable {
    schema = options?.schema;
    table = options?.name ?? 'table';
    noPrimaryKey = options?.noPrimaryKey ?? true;
    columns = columns
      ? this.setColumns(columns, dataFn)
      : { shape: {}, data: [] };
  };
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
    BaseTable,
    table,
  };
};
