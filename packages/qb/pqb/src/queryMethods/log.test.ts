import { createDb } from '../db';
import {
  adapter,
  dbOptions,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { logColors } from './log';
import { noop } from 'orchid-core';

describe('query log', () => {
  useTestDatabase();

  it('should not have `log` query object by default', () => {
    const db = createDb(dbOptions);

    expect(db('user').query.log).toBe(undefined);
  });

  it('should set `log` query object when configuring db instance', () => {
    const db = createDb({
      ...dbOptions,
      log: true,
    });

    expect(db('user').query.log).toBeTruthy();
  });

  it('should set `log` query object for a table', () => {
    const db = createDb(dbOptions);
    const table = db('user', undefined, { log: true });

    expect(table.query.log).toBeTruthy();
  });

  it('should set `log` query object with query method', () => {
    const db = createDb(dbOptions);
    const table = db('user');

    expect(table.log().query.log).toBeTruthy();
  });

  it('should log elapsed time, sql and binding values', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({
      adapter,
      log: true,
      logger,
    });

    await db('user', (t) => ({
      name: t.text(1, 2).primaryKey(),
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
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({
      adapter,
      log: { colors: false },
      logger,
    });

    await db('user', (t) => ({
      name: t.text(1, 2).primaryKey(),
    })).where({ name: 'name' });

    expect(logger.log.mock.calls).toEqual([
      [`(1s 1.0ms) SELECT * FROM "user" WHERE "user"."name" = $1 ['name']`],
    ]);
  });

  it('should log in red in case of error', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({ adapter, log: true, logger });

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
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({
      adapter,
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

  it('should log successful transaction', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValue([0, 0]);
    hrtime.mockReturnValue([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({
      adapter,
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
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValue([0, 0]);
    hrtime.mockReturnValue([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: noop,
    };

    const db = createDb({
      adapter,
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
