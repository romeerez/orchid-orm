import { structureToAst, makeStructureToAstCtx } from './structureToAst';
import { astToMigration } from './astToMigration';
import { makeFileVersion, writeMigrationFile } from '../commands/newMigration';
import { saveMigratedVersion } from '../migration/manageMigratedVersions';
import { AdapterBase, ColumnSchemaConfig } from 'orchid-core';
import { RakeDbConfig } from '../config';

export const pullDbStructure = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  adapter: AdapterBase,
  config: RakeDbConfig<SchemaConfig, CT>,
): Promise<void> => {
  const currentSchema = adapter.schema || 'public';

  const ctx = makeStructureToAstCtx(config, currentSchema);

  const ast = await structureToAst(ctx, adapter, config);

  const result = astToMigration(currentSchema, config, ast);
  if (!result) return;

  const version = await makeFileVersion({}, config);
  await writeMigrationFile(config, version, 'pull', result);

  const silentQueries = Object.assign(adapter, {
    silentQuery: adapter.query,
    silentArrays: adapter.arrays,
  });
  await saveMigratedVersion(silentQueries, version, 'pull', config);

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
};
