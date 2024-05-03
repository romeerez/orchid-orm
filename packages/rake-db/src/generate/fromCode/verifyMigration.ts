import { Adapter } from 'pqb';
import {
  AnyRakeDbConfig,
  createMigrationInterface,
  RakeDbColumnTypes,
} from 'rake-db';
import { composeMigration, ComposeMigrationParams } from './composeMigration';
import { ChangeCallback } from '../../migration/change';
import { ColumnSchemaConfig } from 'orchid-core';
import { introspectDbSchema } from '../dbStructure';
import { AbortSignal } from './generate';

export const verifyMigration = async (
  adapter: Adapter,
  config: AnyRakeDbConfig,
  migrationCode: string,
  generateMigrationParams: ComposeMigrationParams,
): Promise<boolean> => {
  const migrationFn = new Function('change', migrationCode);

  return adapter.transaction(
    { text: 'BEGIN' },
    async (trx) => {
      const changeFns: ChangeCallback<RakeDbColumnTypes>[] = [];
      migrationFn((changeCb: ChangeCallback<RakeDbColumnTypes>) => {
        changeFns.push(changeCb);
      });

      const { log } = config;
      config.log = false;

      const db = createMigrationInterface<
        ColumnSchemaConfig,
        RakeDbColumnTypes
      >(trx, true, config);

      config.log = log;

      for (const changeFn of changeFns) {
        await changeFn(db, true);
      }

      const dbStructure = await introspectDbSchema(trx);
      generateMigrationParams.verifying = true;
      let code;
      try {
        code = await composeMigration(
          adapter,
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

      return !code;
    },
    { text: 'ROLLBACK' },
  );
};
