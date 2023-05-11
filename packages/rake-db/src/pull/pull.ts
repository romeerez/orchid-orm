import { RakeDbConfig } from '../common';
import { Adapter, AdapterOptions } from 'pqb';
import { DbStructure } from './dbStructure';
import { structureToAst, StructureToAstCtx } from './structureToAst';
import { astToMigration } from './astToMigration';
import { makeFileTimeStamp, writeMigrationFile } from '../commands/generate';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';
import { ColumnTypesBase } from 'orchid-core';

export const pullDbStructure = async <CT extends ColumnTypesBase>(
  options: AdapterOptions,
  config: RakeDbConfig<CT>,
): Promise<void> => {
  const adapter = new Adapter(options);
  const currentSchema = adapter.schema || 'public';
  const db = new DbStructure(adapter);

  const ctx: StructureToAstCtx = {
    unsupportedTypes: {},
    snakeCase: config.snakeCase,
    currentSchema,
  };

  const ast = await structureToAst(ctx, db);
  await adapter.close();

  const result = astToMigration(config, ast);
  if (!result) return;

  const version = makeFileTimeStamp();
  await writeMigrationFile(config, version, 'pull', result);

  const silentQueries = Object.assign(adapter, {
    silentQuery: adapter.query,
    silentArrays: adapter.arrays,
  });
  await saveMigratedVersion(silentQueries, version, config);

  const cache = {};
  for (const item of ast) {
    await config?.appCodeUpdater?.process({
      ast: item,
      options,
      basePath: config.basePath,
      cache,
      logger: config.logger,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      baseTable: config.baseTable!,
      import: config.import,
    });
  }

  await config?.appCodeUpdater?.afterAll({
    options,
    basePath: config.basePath,
    cache,
    logger: config.logger,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    baseTable: config.baseTable!,
    import: config.import,
  });

  const unsupportedEntries = Object.entries(ctx.unsupportedTypes);
  const len = unsupportedEntries.length;
  if (len) {
    let count = 0;
    config.logger?.warn(
      `Found unsupported types:\n${unsupportedEntries
        .map(([type, columns]) => {
          count += columns.length;
          return `- ${type} is used for column${
            columns.length > 1 ? 's' : ''
          } ${columns.join(', ')}`;
        })
        .join('\n')}\nAppend \`as\` method manually to ${
        count > 1 ? 'these' : 'this'
      } column${count > 1 ? 's' : ''} to treat ${
        count > 1 ? 'them' : 'it'
      } as other column type`,
    );
  }

  config.logger?.log('Database pulled successfully');
  adapter.close();
};
