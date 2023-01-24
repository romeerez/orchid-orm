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
  const db = new DbStructure(new Adapter(options));
  const ast = await structureToAst(db);
  const result = astToMigration(ast);
  if (!result) return;

  await writeMigrationFile(config, 'pull', result);
};
