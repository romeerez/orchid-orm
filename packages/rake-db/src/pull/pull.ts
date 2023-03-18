import { RakeDbConfig } from '../common';
import { Adapter, AdapterOptions } from 'pqb';
import { DbStructure } from './dbStructure';
import { structureToAst } from './structureToAst';
import { astToMigration } from './astToMigration';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';

export const pullDbStructure = async (
  options: AdapterOptions,
  config: RakeDbConfig,
) => {
  const adapter = new Adapter(options);
  const db = new DbStructure(adapter);
  const ast = await structureToAst(config, db);

  await adapter.close();

  const result = astToMigration(config, ast);
  if (!result) return;

  const version = makeFileTimeStamp();
  await writeMigrationFile(config, version, 'pull', result);

  await saveMigratedVersion(adapter, version, config);

  const cache = {};
  for (const item of ast) {
    await config?.appCodeUpdater?.({
      ast: item,
      options,
      basePath: config.basePath,
      cache,
      logger: config.logger,
    });
  }
};
