import { AdapterBase } from 'pqb';
import {
  MigrateFn,
  migrate,
  rollback,
  redo,
} from '../commands/migrate-or-rollback';
import { RakeDbConfig } from '../config';

const makeMigrateOrRollback =
  (fn: MigrateFn) =>
  async (
    adapters: AdapterBase[],
    config: RakeDbConfig,
    args: string[],
  ): Promise<void> => {
    const arg = args[0];
    let force: boolean | undefined;
    let count: number | undefined;
    if (arg === 'force') {
      force = true;
    } else {
      const num = arg === 'all' ? Infinity : parseInt(arg || '');
      if (!isNaN(num)) {
        count = num;
      }
    }

    for (const adapter of adapters) {
      await fn(adapter, config, { ctx: {}, count, force });
    }
  };

export const migrateCommand = makeMigrateOrRollback(migrate);

export const rollbackCommand = makeMigrateOrRollback(rollback);

export const redoCommand = makeMigrateOrRollback(redo);
