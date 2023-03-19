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
  const unsupportedTypes: Record<string, string[]> = {};

  const ast = await structureToAst(unsupportedTypes, db);

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

  const unsupportedEntries = Object.entries(unsupportedTypes);
  const len = unsupportedEntries.length;
  if (len) {
    let count = 0;
    config.logger?.warn(
      `Found unsupported types:\n${unsupportedEntries
        .map(([type, columns]) => {
          count += columns.length;
          return `${type} is used for column${
            columns.length > 1 ? 's' : ''
          } ${columns.join(', ')}`;
        })
        .join('\n')}\n\nAppend \`as\` method manually to ${
        count > 1 ? 'these' : 'this'
      } column${count > 1 ? 's' : ''} to treat ${
        count > 1 ? 'them' : 'it'
      } as other column type`,
    );
  }

  config.logger?.log('Database pulled successfully');
};
