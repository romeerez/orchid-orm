import { RakeDbConfig } from '../common';
import { Adapter, AdapterOptions } from 'pqb';
import { DbStructure } from './dbStructure';
import { structureToAst } from './structureToAst';
import { astToMigration } from './astToMigration';
import { writeMigrationFile } from '../commands/generate';

export const pullDbStructure = async (
  options: AdapterOptions,
  config: RakeDbConfig,
) => {
  const adapter = new Adapter(options);
  const db = new DbStructure(adapter);
  const ast = await structureToAst(db);

  await adapter.close();

  const result = astToMigration(ast);
  if (!result) return;

  await writeMigrationFile(config, 'pull', result);
};
