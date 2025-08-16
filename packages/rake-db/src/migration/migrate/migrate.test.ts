import { orchidORM, testTransaction } from 'orchid-orm';
import { testAdapter } from 'test-utils';
import { migrateFiles } from './migrate';
import { rakeDb } from '../../rakeDb';

const logger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export const { change } = rakeDb.lazy([], {
  log: { colors: false },
  logger,
} as never);

const db = orchidORM(
  {
    adapter: testAdapter,
    log: { colors: false },
    logger,
  },
  {},
);

describe('migrateFiles', () => {
  afterAll(() => db.$close());

  it('should start a transaction for migrations', async () => {
    await migrateFiles(db, [
      () => import('./migrate.test.file1'),
      () => import('./migrate.test.file2'),
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
        () => import('./migrate.test.file1'),
        () => import('./migrate.test.file2'),
      ]);

      expect(logger.log.mock.calls).toEqual([
        [expect.stringContaining(`SELECT 'test query 1'`)],
        [expect.stringContaining(`SELECT 'test query 2'`)],
      ]);
    });
  });
});
