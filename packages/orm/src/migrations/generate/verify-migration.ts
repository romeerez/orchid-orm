import { Adapter } from 'pqb/internal';
import {
  createMigrationInterface,
  ChangeCallback,
  introspectDbSchema,
  RakeDbConfig,
} from 'rake-db';
import { composeMigration, ComposeMigrationParams } from './compose-migration';
import { AbortSignal } from './generate';

const rollbackErr = new Error('Rollback');

export const verifyMigration = async (
  adapter: Adapter,
  config: RakeDbConfig,
  migrationCode: string,
  generateMigrationParams: ComposeMigrationParams,
  roles?: { whereSql?: string },
  defaultPrivileges?: { loadDefaultPrivileges?: boolean },
): Promise<string | false | undefined> => {
  const migrationFn = new Function('change', migrationCode);

  let code: string | false | undefined;

  try {
    await adapter.transaction(undefined, undefined, async (trx) => {
      const changeFns: ChangeCallback<unknown>[] = [];
      migrationFn((changeCb: ChangeCallback<unknown>) => {
        changeFns.push(changeCb);
      });

      const { log } = config;
      config.log = false;

      const db = createMigrationInterface(trx, true, config).getDb(
        config.columnTypes,
      );

      config.log = log;

      for (const changeFn of changeFns) {
        await changeFn(db, true);
      }

      const dbStructure = await introspectDbSchema(trx, {
        rls: generateMigrationParams.codeItems.tables.some(
          (table) => !!table.internal.tableRls,
        ),
        roles,
        loadDefaultPrivileges: defaultPrivileges?.loadDefaultPrivileges,
      });
      generateMigrationParams.verifying = true;

      try {
        code = await composeMigration(
          trx,
          config,
          [],
          dbStructure,
          generateMigrationParams,
        );
      } catch (err) {
        if (err instanceof AbortSignal) {
          code = false;
          throw rollbackErr;
        }
        throw err;
      }

      throw rollbackErr;
    });
  } catch (err) {
    if (err !== rollbackErr) {
      throw err;
    }
  }

  return code;
};
