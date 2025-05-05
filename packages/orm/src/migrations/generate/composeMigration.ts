import { Adapter, QueryInternal } from 'pqb';
import {
  AnyRakeDbConfig,
  RakeDbAst,
  IntrospectedStructure,
  makeDomainsMap,
  StructureToAstCtx,
  astToMigration,
} from 'rake-db';
import { processSchemas } from './generators/schemas.generator';
import { processExtensions } from './generators/extensions.generator';
import { processDomains } from './generators/domains.generator';
import { processEnums } from './generators/enums.generator';
import { processTables } from './generators/tables.generator';
import { CodeItems } from './generate';

export interface ComposeMigrationParams {
  structureToAstCtx: StructureToAstCtx;
  codeItems: CodeItems;
  currentSchema: string;
  internal: QueryInternal;
  verifying?: boolean;
}

export const composeMigration = async (
  adapter: Adapter,
  config: AnyRakeDbConfig,
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  params: ComposeMigrationParams,
): Promise<string | undefined> => {
  const { structureToAstCtx, currentSchema } = params;

  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  await processSchemas(ast, dbStructure, params);
  processExtensions(ast, dbStructure, params);
  await processDomains(ast, adapter, domainsMap, dbStructure, params);
  await processEnums(ast, dbStructure, params);
  await processTables(ast, domainsMap, adapter, dbStructure, config, params);

  return astToMigration(currentSchema, config, ast);
};
