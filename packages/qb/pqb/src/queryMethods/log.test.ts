import { createDb } from '../query/db';
import { userData } from '../test-utils/test-utils';
import { logColors, noop } from 'orchid-core';
import { testAdapter, testDbOptions, useTestDatabase } from 'test-utils';

const hrtime = jest.spyOn(process, 'hrtime');
hrtime.mockReturnValue([0, 0]);
hrtime.mockReturnValue([1, 1000000]);

const logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: noop,
};

describe('query log', () => {
  useTestDatabase();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not have `log` query object by default', () => {
    const db = createDb(testDbOptions);

    expect(db('user').q.log).toBe(undefined);
  });

  it('should set `log` query object when configuring db instance', () => {
    const db = createDb({
      ...testDbOptions,
      log: true,
    });

    expect(db('user').q.log).toBeTruthy();
  });

  it('should set `log` query object for a table', () => {
    const db = createDb(testDbOptions);
    const table = db('user', undefined, undefined, { log: true });

    expect(table.q.log).toBeTruthy();
  });

  it('should set `log` query object with query method', () => {
    const db = createDb(testDbOptions);
    const table = db('user');

    expect(table.log().q.log).toBeTruthy();
  });

  it('should log elapsed time, sql and binding values', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: true,
      logger,
    });

    await db('user', (t) => ({
      name: t.text().primaryKey(),
    })).where({ name: 'name' });

    expect(logger.log.mock.calls).toEqual([
      [
        `${logColors.boldCyanBright('(1s 1.0ms)')} ${logColors.boldBlue(
          `SELECT * FROM "user" WHERE "user"."name" = $1`,
        )} ${logColors.boldYellow(`['name']`)}`,
      ],
    ]);
  });

  it('should log elapsed time, sql and binding values without colors', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await db('user', (t) => ({
      name: t.text().primaryKey(),
    })).where({ name: 'name' });

    expect(logger.log.mock.calls).toEqual([
      [`(1s 1.0ms) SELECT * FROM "user" WHERE "user"."name" = $1 ['name']`],
    ]);
  });

  it('should log when using db.query', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await db.query`SELECT 1`;

    expect(logger.log.mock.calls).toEqual([[`(1s 1.0ms) SELECT 1`]]);
  });

  it('should log in red in case of error', async () => {
    const db = createDb({ adapter: testAdapter, log: true, logger });

    await db('user').where({ wrongColumn: 'value' }).then(noop, noop);

    expect(logger.error.mock.calls).toEqual([
      [
        `${logColors.boldMagenta('(1s 1.0ms)')} ${logColors.boldRed(
          `SELECT * FROM "user" WHERE "wrongColumn" = $1`,
        )} ${logColors.boldYellow(`['value']`)} ${logColors.boldRed(
          'Error: column "wrongColumn" does not exist',
        )}`,
      ],
    ]);
  });

  it('should log in red in case of error without colors', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await db('user').where({ wrongColumn: 'value' }).then(noop, noop);

    expect(logger.error.mock.calls).toEqual([
      [
        `(1s 1.0ms) SELECT * FROM "user" WHERE "wrongColumn" = $1 ['value'] Error: column "wrongColumn" does not exist`,
      ],
    ]);
  });

  it('should log when using db.query', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await db.query`SELECT something`.then(noop, noop);

    expect(logger.error.mock.calls).toEqual([
      [`(1s 1.0ms) SELECT something Error: column "something" does not exist`],
    ]);
  });

  it('should log successful transaction', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await db.transaction(async () => {
      await db('user').create(userData);
    });

    expect(logger.log.mock.calls).toEqual([
      ['(1s 1.0ms) BEGIN'],
      [expect.stringContaining('INSERT INTO "user"')],
      ['(1s 1.0ms) COMMIT'],
    ]);
  });

  it('should log failed transaction', async () => {
    const db = createDb({
      adapter: testAdapter,
      log: { colors: false },
      logger,
    });

    await expect(
      db.transaction(async () => {
        await db('user').create({ name: 'name' });
      }),
    ).rejects.toThrow();

    expect(logger.log.mock.calls).toEqual([
      ['(1s 1.0ms) BEGIN'],
      ['(1s 1.0ms) ROLLBACK'],
    ]);
  });
});
