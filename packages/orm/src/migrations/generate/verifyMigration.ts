import { ColumnSchemaConfig } from 'orchid-core';
import { Adapter } from 'pqb';
import {
  AnyRakeDbConfig,
  createMigrationInterface,
  ChangeCallback,
  introspectDbSchema,
} from 'rake-db';
import { composeMigration, ComposeMigrationParams } from './composeMigration';
import { AbortSignal } from './generate';

export const verifyMigration = async (
  adapter: Adapter,
  config: AnyRakeDbConfig,
  migrationCode: string,
  generateMigrationParams: ComposeMigrationParams,
): Promise<string | false | undefined> => {
  const migrationFn = new Function('change', migrationCode);

  return adapter.transaction(
    { text: 'BEGIN' },
    async (trx) => {
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
      let code: string | undefined;
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
          return false;
        }
        throw err;
      }

      return code;
    },
    { text: 'ROLLBACK' },
  );
};
