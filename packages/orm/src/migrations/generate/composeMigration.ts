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
  {
    structureToAstCtx,
    codeItems: { schemas, enums, tables, domains },
    currentSchema,
    internal,
    verifying,
  }: ComposeMigrationParams,
): Promise<string | undefined> => {
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  await processSchemas(ast, schemas, dbStructure, verifying);
  processExtensions(ast, dbStructure, currentSchema, internal.extensions);
  await processDomains(
    ast,
    adapter,
    structureToAstCtx,
    domainsMap,
    dbStructure,
    currentSchema,
    domains,
  );
  await processEnums(ast, enums, dbStructure, currentSchema, verifying);
  await processTables(
    ast,
    structureToAstCtx,
    domainsMap,
    adapter,
    tables,
    dbStructure,
    currentSchema,
    config,
    internal.generatorIgnore,
    verifying,
  );

  return astToMigration(currentSchema, config, ast);
};
