import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
  MaybeArray,
  noop,
} from 'orchid-core';
import {
  Adapter,
  AdapterOptions,
  DbSharedOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  TableDataFn,
  TableDataItem,
} from 'pqb';
import { orchidORM } from '../../../orm';
import {
  ChangeCallback,
  promptSelect,
  AnyRakeDbConfig,
  createMigrationInterface,
  migrate,
} from 'rake-db';
import { asMock, testColumnTypes } from 'test-utils';
import { generate } from '../generate';
import fs from 'fs/promises';
import { testConfig } from '../../migrations.test-utils';
import { createBaseTable } from '../../../baseTable';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
  snakeCase: true,
});

const defaultOptions: AdapterOptions[] = [
  { databaseURL: process.env.PG_GENERATE_URL },
];
let options = defaultOptions;

let config: AnyRakeDbConfig = testConfig;

let prepareDbTransactionPromise: Promise<void> | undefined;
let resolvePrepareDbTransaction: (() => void) | undefined;
let arrangedAdapters: Adapter[] | undefined;

const arrange = async (arg: {
  config?: AnyRakeDbConfig;
  options?: AdapterOptions[];
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
        db: orchidORM(
          { noPrimaryKey: 'ignore', ...arg.dbOptions },
          arg.tables
            ? Object.fromEntries(arg.tables.map((klass) => [klass.name, klass]))
            : {},
        ),
      }),
  };

  options = arg.options ?? defaultOptions;

  const adapters = options.map((opts) => new Adapter(opts));
  arrangedAdapters = [...adapters];

  const { prepareDb } = arg;
  if (prepareDb) {
    await new Promise<void>((resolve) => {
      const adapter = adapters[0];
      prepareDbTransactionPromise = adapter.transaction(
        { text: 'BEGIN' },
        (trx) =>
          new Promise<void>(async (resolveTransaction) => {
            // `generate` will attempt to close the adapter, but we need to keep it open in the test
            trx.close = noop as () => Promise<void>;

            adapters[0] = trx;

            const db = createMigrationInterface<
              ColumnSchemaConfig,
              DefaultColumnTypes<DefaultSchemaConfig>
            >(trx, true, config);

            await prepareDb(db, true);

            resolve();

            resolvePrepareDbTransaction = resolveTransaction;
          }),
        { text: 'ROLLBACK' },
      );
    });
  }

  asMock(migrate).mockResolvedValue(adapters);

  if (arg.selects) {
    for (const select of arg.selects) {
      asMock(promptSelect).mockResolvedValueOnce(select);
    }
  }
};

const act = () => generate(options, config, []);

const assert = {
  migration(code?: string) {
    expect(asMock(fs.writeFile).mock.calls[0]?.[1]).toBe(code);
  },
  report(...logs: string[]) {
    const calls = asMock(config.logger?.log).mock.calls[0][0];
    expect(calls).toBe(logs.join('\n'));
  },
};

const table = <Shape extends ColumnsShapeBase>(
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
  jest.setTimeout(10000);

  beforeEach(jest.clearAllMocks);

  afterEach(async () => {
    resolvePrepareDbTransaction?.();
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
