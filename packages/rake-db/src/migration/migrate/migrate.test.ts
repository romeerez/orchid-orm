import { orchidORMWithAdapter, testTransaction } from 'orchid-orm';
import { TestAdapter, testAdapter, testDbOptions } from 'test-utils';
import { makeMigrateAdapter, migrateFiles } from './migrate';
import { rakeDbWithAdapters } from '../../rake-db';
import { pathToFileURL } from 'node:url';
import path from 'path';

const logger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export const { change } = rakeDbWithAdapters.lazy([], {
  log: { colors: false },
  logger,
} as never);

const db = orchidORMWithAdapter(
  {
    adapter: testAdapter,
    log: { colors: false },
    logger,
  },
  {},
);

afterEach(jest.clearAllMocks);

afterAll(() => db.$close());

describe('makeMigrateAdapter', () => {
  it('should run migrations for adapter with default configs', async () => {
    await db.$query`DELETE FROM "schemaMigrations"`;
    jest.clearAllMocks();

    const migrateAdapter = makeMigrateAdapter({
      migrationsPath: './mock-migrations',
      log: { colors: false },
      logger,
      import: (path) => import(path),
    });

    await migrateAdapter(new TestAdapter(testDbOptions));

    expect(logger.log.mock.calls).toEqual([
      [
        expect.stringContaining(
          `Migrating database ${testAdapter.getDatabase()}`,
        ),
      ],
      [expect.stringContaining(`SELECT 'test query 1'`)],
      [
        expect.stringContaining(
          `Migrated ${pathToFileURL(
            path.resolve(
              __dirname,
              './mock-migrations/1001_migrate.test.file1',
            ),
          )}`,
        ),
      ],
      [expect.stringContaining(`SELECT 'test query 2'`)],
      [
        expect.stringContaining(
          `Migrated ${pathToFileURL(
            path.resolve(
              __dirname,
              './mock-migrations/1002_migrate.test.file2',
            ),
          )}`,
        ),
      ],
    ]);
  });
});

describe('migrateFiles', () => {
  it('should start a transaction for migrations', async () => {
    await migrateFiles(db, [
      () => import('./mock-migrations/1001_migrate.test.file1'),
      () => import('./mock-migrations/1002_migrate.test.file2'),
    ]);

    expect(logger.log.mock.calls).toEqual([
      [expect.stringContaining('BEGIN')],
      [expect.stringContaining(`SELECT 'test query 1'`)],
      [expect.stringContaining(`SELECT 'test query 2'`)],
      [expect.stringContaining('COMMIT')],
    ]);
  });

  describe('in a test transaction', () => {
    beforeEach(() => testTransaction.start(db));
    afterEach(() => testTransaction.rollback(db));

    it('should reuse a test transaction for migrations', async () => {
      jest.clearAllMocks();

      await migrateFiles(db, [
        () => import('./mock-migrations/1001_migrate.test.file1'),
        () => import('./mock-migrations/1002_migrate.test.file2'),
      ]);

      expect(logger.log.mock.calls).toEqual([
        [expect.stringContaining(`SELECT 'test query 1'`)],
        [expect.stringContaining(`SELECT 'test query 2'`)],
      ]);
    });
  });
});
