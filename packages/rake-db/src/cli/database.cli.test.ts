import {
  createDatabaseCommand,
  dropDatabaseCommand,
  resetDatabaseCommand,
} from './database.cli';
import {
  PostgresJsAdapter,
  PostgresJsTransactionAdapter,
} from 'pqb/postgres-js';
import { promptConfirm, promptText } from '../prompt';
import {
  createDatabase,
  CreateOrDropError,
  createSchema,
  dropDatabase,
} from '../commands/create-or-drop';
import { testConfig } from '../rake-db.test-utils';
import { migrate } from '../commands/migrate-or-rollback';
import { asMock } from 'test-utils';
import { createMigrationsSchemaAndTable } from '../migration/manage-migrated-versions';
import { runRecurrentMigrations } from '../commands/recurrent';

jest.mock('../migration/manage-migrated-versions', () => ({
  createMigrationsSchemaAndTable: jest.fn(),
}));

jest.mock('../commands/recurrent', () => ({
  runRecurrentMigrations: jest.fn(),
}));

jest.mock('../commands/create-or-drop', () => ({
  ...jest.requireActual('../commands/create-or-drop'),
  createDatabase: jest.fn(() => 'done'),
  dropDatabase: jest.fn(() => 'done'),
  createSchema: jest.fn(() => 'done'),
  createTable: jest.fn(() => 'done'),
}));

jest.mock('../commands/migrate-or-rollback', () => ({
  migrate: jest.fn(),
}));

jest.mock('../prompt', () => ({
  promptConfirm: jest.fn(),
  promptText: jest.fn(),
}));

const database = 'dbname';
const owner = 'username';

const makeAdapter = () => {
  const adapter = new PostgresJsAdapter({});

  adapter.getDatabase = () => database;
  adapter.getUser = () => owner;

  jest.spyOn(adapter, 'reconfigure').mockImplementation(() => adapter);

  const tx = Object.create(adapter) as unknown as PostgresJsTransactionAdapter;

  jest.spyOn(adapter, 'transaction').mockImplementation((_, fn) => fn(tx));

  jest.spyOn(adapter, 'close').mockImplementation(() => Promise.resolve());

  return { adapter, tx };
};

const { adapter } = makeAdapter();
const config = {
  ...testConfig,
  schema: 'common-schema',
  migrationsTable: 'migrations-schema.migrations-table',
  recurrentPath: 'recurrent',
};

const adapters = [adapter];

const log = asMock(config.logger.log);

describe('create or drop database', () => {
  afterEach(jest.clearAllMocks);

  describe('create database', () => {
    it('should create multiple databases', async () => {
      const items = [makeAdapter(), makeAdapter()];

      await createDatabaseCommand(
        items.map((x) => x.adapter),
        config,
      );

      for (const { adapter, tx } of items) {
        expect(adapter.reconfigure).toHaveBeenCalledWith({
          database: 'postgres',
        });

        expect(createDatabase).toHaveBeenCalledTimes(2);
        expect(createDatabase).toHaveBeenCalledWith(adapter, {
          database,
          owner,
        });

        expect(createSchema).toHaveBeenCalledWith(tx, '"common-schema"');

        expect(createMigrationsSchemaAndTable).toHaveBeenCalledWith(tx, config);

        expect(adapter.close).toHaveBeenCalled();
      }

      expect(log.mock.calls).toEqual([
        ['Database dbname successfully created'],
        ['Created schema "common-schema"'],
        ['Database dbname successfully created'],
        ['Created schema "common-schema"'],
      ]);
    });

    it('should report if db already exists', async () => {
      jest.mocked(createDatabase).mockResolvedValue('already');

      await createDatabaseCommand(adapters, config);

      expect(log).toHaveBeenCalledWith(`Database dbname already exists`);
    });

    it('should abort if ssl is required', async () => {
      jest
        .mocked(createDatabase)
        .mockRejectedValueOnce(
          new CreateOrDropError('', 'ssl-required', undefined),
        );

      await createDatabaseCommand(adapters, config);

      expect(log).toHaveBeenCalledWith(
        `SSL is required: append ?ssl=true to the database url string`,
      );
    });

    it.each(['forbidden', 'auth-failed'] as const)(
      'should prompt if %s',
      async (status) => {
        jest.mocked(promptConfirm).mockResolvedValue(true);
        jest.mocked(promptText).mockResolvedValueOnce('admin');
        jest.mocked(promptText).mockResolvedValueOnce('pw');

        jest
          .mocked(createDatabase)
          .mockRejectedValueOnce(new CreateOrDropError('', status, undefined));

        await createDatabaseCommand(adapters, config);

        expect(promptConfirm).toHaveBeenCalled();

        expect(adapter.reconfigure).toHaveBeenCalledWith({
          user: 'admin',
          password: 'pw',
        });
        expect(createDatabase).toHaveBeenCalledTimes(2);
      },
    );

    it('should not close db if dontClose option is provided', async () => {
      jest
        .spyOn(adapter, 'reconfigure')
        .mockImplementationOnce(() => makeAdapter().adapter);

      await createDatabaseCommand(adapters, config, true);

      expect(adapter.close).not.toHaveBeenCalled();
    });
  });

  describe('dropDatabase', () => {
    it('should drop multiple databases', async () => {
      const items = [makeAdapter(), makeAdapter()];

      await dropDatabaseCommand(
        items.map((x) => x.adapter),
        config,
      );

      for (const { adapter } of items) {
        expect(adapter.reconfigure).toHaveBeenCalledWith({
          database: 'postgres',
        });

        expect(dropDatabase).toHaveBeenCalledTimes(2);
        expect(dropDatabase).toHaveBeenCalledWith(adapter, {
          database,
          owner,
        });

        expect(adapter.close).toHaveBeenCalled();
      }

      expect(log.mock.calls).toEqual([
        ['Database dbname successfully dropped'],
        ['Database dbname successfully dropped'],
      ]);
    });

    it('should report if db already dropped', async () => {
      jest.mocked(dropDatabase).mockResolvedValue('already');

      await dropDatabaseCommand(adapters, config);

      expect(log).toHaveBeenCalledWith(`Database dbname does not exist`);
    });

    it('should abort if ssl is required', async () => {
      jest
        .mocked(dropDatabase)
        .mockRejectedValueOnce(
          new CreateOrDropError('', 'ssl-required', undefined),
        );

      await dropDatabaseCommand(adapters, config);

      expect(log).toHaveBeenCalledWith(
        `SSL is required: append ?ssl=true to the database url string`,
      );
    });

    it.each(['forbidden', 'auth-failed'] as const)(
      'should prompt if %s',
      async (status) => {
        jest.mocked(promptConfirm).mockResolvedValue(true);
        jest.mocked(promptText).mockResolvedValueOnce('admin');
        jest.mocked(promptText).mockResolvedValueOnce('pw');

        jest
          .mocked(dropDatabase)
          .mockRejectedValueOnce(new CreateOrDropError('', status, undefined));

        await dropDatabaseCommand(adapters, config);

        expect(promptConfirm).toHaveBeenCalled();

        expect(adapter.reconfigure).toHaveBeenCalledWith({
          user: 'admin',
          password: 'pw',
        });
        expect(dropDatabase).toHaveBeenCalledTimes(2);
      },
    );
  });

  describe('resetDatabase', () => {
    it('should drop, create, migrate, close adapters', async () => {
      const items = [makeAdapter(), makeAdapter()];
      const adminAdapters = items.map(() => makeAdapter().adapter);

      items.forEach(({ adapter }, i) => {
        jest
          .spyOn(adapter, 'reconfigure')
          .mockImplementation(() => adminAdapters[i]);
      });

      await resetDatabaseCommand(
        items.map((x) => x.adapter),
        config,
      );

      expect(dropDatabase).toHaveBeenCalledTimes(2);
      for (const adapter of adminAdapters) {
        expect(dropDatabase).toHaveBeenCalledWith(adapter, {
          database: 'dbname',
          owner: 'username',
        });
      }

      expect(createDatabase).toHaveBeenCalledTimes(2);
      for (const adapter of adminAdapters) {
        expect(createDatabase).toHaveBeenCalledWith(adapter, {
          database: 'dbname',
          owner: 'username',
        });
      }

      expect(migrate).toHaveBeenCalledTimes(2);
      for (const { adapter } of items) {
        expect(migrate).toHaveBeenCalledWith(adapter, config);
      }

      expect(runRecurrentMigrations).toHaveBeenCalledWith(
        items.map((x) => x.adapter),
        config,
      );

      for (const { adapter } of items) {
        expect(adapter.close).toHaveBeenCalled();
      }
    });
  });
});
