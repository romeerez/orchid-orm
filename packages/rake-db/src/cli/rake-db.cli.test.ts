import { rakeDbCliWithAdapter } from './rake-db.cli';
import { assertType, testAdapter } from 'test-utils';
import {
  createDatabaseCommand,
  dropDatabaseCommand,
  resetDatabaseCommand,
} from './database.cli';
import { migrateCommand, redoCommand, rollbackCommand } from './migrate.cli';
import { runRecurrentMigrations } from '../commands/recurrent';
import { pullDbStructure } from '../generate/pull';
import { listMigrationsStatuses } from '../commands/list-migrations-statuses';
import { rebase } from '../commands/rebase';
import { changeIds } from '../commands/change-ids';
import { DefaultSchemaConfig, IntegerColumn, noop } from 'pqb';
import { RakeDbError } from 'rake-db';
import { clearChanges, getCurrentChanges } from '../migration/change';
import { newMigration } from '../commands/new-migration';

jest.mock('./database.cli', () => ({
  createDatabaseCommand: jest.fn(),
  dropDatabaseCommand: jest.fn(),
  resetDatabaseCommand: jest.fn(),
}));

jest.mock('./migrate.cli', () => ({
  migrateCommand: jest.fn(() => Promise.resolve()),
  rollbackCommand: jest.fn(() => Promise.resolve()),
  redoCommand: jest.fn(() => Promise.resolve()),
}));

jest.mock('../commands/recurrent', () => ({
  runRecurrentMigrations: jest.fn(),
}));

jest.mock('../generate/pull', () => ({
  pullDbStructure: jest.fn(() => Promise.resolve()),
}));

jest.mock('../commands/list-migrations-statuses', () => ({
  listMigrationsStatuses: jest.fn(),
}));

jest.mock('../commands/rebase', () => ({
  rebase: jest.fn(() => Promise.resolve()),
}));

jest.mock('../commands/change-ids', () => ({
  changeIds: jest.fn(),
}));

jest.mock('../commands/new-migration', () => ({
  newMigration: jest.fn(),
}));

const act = (args: string[]) =>
  rakeDbCliWithAdapter({
    migrations: {},
    recurrentPath: 'path',
  }).run(testAdapter, args);

describe('rake-db cli interface', () => {
  beforeEach(jest.clearAllMocks);
  beforeEach(clearChanges);

  it('should create a database', async () => {
    await act(['create']);

    expect(createDatabaseCommand).toHaveBeenCalledTimes(1);
  });

  it('should drop a database', async () => {
    await act(['drop']);

    expect(dropDatabaseCommand).toHaveBeenCalledTimes(1);
  });

  it('should reset a database', async () => {
    await act(['reset']);

    expect(resetDatabaseCommand).toHaveBeenCalledTimes(1);
  });

  it.each(['migrate', 'up'])(
    'should migrate a database and run recurrent migrations by %s command',
    async (command) => {
      await act([command]);

      expect(migrateCommand).toHaveBeenCalledTimes(1);
      expect(runRecurrentMigrations).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['rollback', 'down'])(
    'should rollback a database by %s command',
    async (command) => {
      await act([command]);

      expect(rollbackCommand).toHaveBeenCalledTimes(1);
    },
  );

  it('should redo a migration and run recurrent migrations by %s command', async () => {
    await act(['redo']);

    expect(redoCommand).toHaveBeenCalledTimes(1);
    expect(runRecurrentMigrations).toHaveBeenCalledTimes(1);
  });

  it('should support pull', async () => {
    await act(['pull']);

    expect(pullDbStructure).toHaveBeenCalledTimes(1);
  });

  it('should make a new migration', async () => {
    await act(['new', 'name']);

    expect(newMigration).toHaveBeenCalledTimes(1);
  });

  it('should fail if new command is called without argument', async () => {
    await expect(act(['new'])).rejects.toThrow('Migration name is missing');
  });

  it.each(['status', 's'])(
    'should show migrations status by %s command',
    async (command) => {
      await act([command]);

      expect(listMigrationsStatuses).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['recurrent', 'rec'])(
    'should run recurrent migrations by %s command',
    async (command) => {
      await act([command]);

      expect(runRecurrentMigrations).toHaveBeenCalledTimes(1);
    },
  );

  it('should support rebase', async () => {
    await act(['rebase']);

    expect(rebase).toHaveBeenCalledTimes(1);
  });

  describe('change-ids', () => {
    it('should support changing ids format by change-ids command', async () => {
      await act(['change-ids', 'serial']);

      expect(changeIds).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid argument', async () => {
      await expect(act(['change-ids', ''])).rejects.toThrow(
        `Pass "serial" or "timestamp" argument to the "change-ids" command`,
      );
    });
  });

  it('should support a custom command', async () => {
    const custom = jest.fn();

    await rakeDbCliWithAdapter({
      migrations: {},
      commands: {
        custom,
      },
    }).run(testAdapter, ['custom', 'arg']);

    expect(custom).toHaveBeenCalledTimes(1);
    expect(custom).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      ['arg'],
    );
  });

  it('should log help when unknown command is requested', async () => {
    const log = jest.fn();

    await rakeDbCliWithAdapter({
      migrations: {},
      logger: {
        log,
        warn: noop,
        error: noop,
      },
    }).run(testAdapter, ['unknown']);

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('should log error and exit process with 1 when RakeDbError thrown', async () => {
    const err = new RakeDbError('message');
    const errorLog = jest.fn();
    const exit = jest.fn(() => undefined as never);
    process.exit = exit;

    await expect(
      rakeDbCliWithAdapter({
        migrations: {},
        commands: {
          custom() {
            throw err;
          },
        },
        logger: {
          log: noop,
          warn: noop,
          error: errorLog,
        },
      }).run(testAdapter, ['custom']),
    ).rejects.toThrow(err);

    expect(errorLog).toHaveBeenCalledWith('message');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should return a `change function and not run the command by default', async () => {
    const custom = jest.fn();

    const { change } = rakeDbCliWithAdapter({
      migrations: {},
      commands: {
        custom,
      },
    });

    expect(custom).not.toHaveBeenCalled();

    const fn = async () => {};
    const result = change(fn);

    expect(getCurrentChanges()).toEqual([{ fn, config: expect.any(Object) }]);
    expect(result.fn).toBe(fn);

    // for issue https://github.com/romeerez/orchid-orm/issues/538
    change(async (db) => {
      db.createTable('table', (t) => {
        const column = t.integer();
        assertType<typeof column, IntegerColumn<DefaultSchemaConfig>>();
        return {};
      });
    });
  });

  it('should return a `change` function and run a command when calling rakeDb.run', async () => {
    const promise = Promise.resolve();
    const custom = jest.fn(() => promise);

    const change = rakeDbCliWithAdapter.run(
      testAdapter,
      {
        migrations: {},
        commands: {
          custom,
        },
      },
      ['custom'],
    );

    await promise;
    expect(custom).toHaveBeenCalledTimes(1);

    const fn = async () => {};
    const result = change(fn);

    expect(getCurrentChanges()).toEqual([{ fn, config: expect.any(Object) }]);
    expect(result.fn).toBe(fn);

    // for issue https://github.com/romeerez/orchid-orm/issues/538
    change(async (db) => {
      db.createTable('table', (t) => {
        const column = t.integer();
        assertType<typeof column, IntegerColumn<DefaultSchemaConfig>>();
        return {};
      });
    });
  });
});
