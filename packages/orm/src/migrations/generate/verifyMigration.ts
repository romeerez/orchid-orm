import { AdapterBase, ColumnSchemaConfig } from 'orchid-core';
import {
  AnyRakeDbConfig,
  createMigrationInterface,
  ChangeCallback,
  introspectDbSchema,
} from 'rake-db';
import { composeMigration, ComposeMigrationParams } from './composeMigration';
import { AbortSignal } from './generate';

const rollbackErr = new Error('Rollback');

export const verifyMigration = async (
  adapter: AdapterBase,
  config: AnyRakeDbConfig,
  migrationCode: string,
  generateMigrationParams: ComposeMigrationParams,
): Promise<string | false | undefined> => {
  const migrationFn = new Function('change', migrationCode);

  let code: string | false | undefined;

  try {
    await adapter.transaction(undefined, async (trx) => {
      const changeFns: ChangeCallback<unknown>[] = [];
      migrationFn((changeCb: ChangeCallback<unknown>) => {
        changeFns.push(changeCb);
      });

      const { log } = config;
      config.log = false;

      const db = createMigrationInterface<ColumnSchemaConfig, unknown>(
        trx,
        true,
        config,
      );

      config.log = log;

      for (const changeFn of changeFns) {
        await changeFn(db, true);
      }

      const dbStructure = await introspectDbSchema(trx);
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
