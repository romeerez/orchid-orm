import { QueryInternal, AdapterBase } from 'pqb';
import {
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
import { RakeDbConfig } from 'rake-db';

export interface ComposeMigrationParams {
  structureToAstCtx: StructureToAstCtx;
  codeItems: CodeItems;
  currentSchema: string;
  internal: QueryInternal;
  verifying?: boolean;
}

/**
 * This is needed to compare SQLs of table expressions.
 * Need to exclude table columns of pending types, such as enums or domains,
 * that aren't created yet from the SQL comparison.
 * Otherwise, the comparison fails because of the unknown types.
 */
export class PendingDbTypes {
  set = new Set<string>();
  add(schemaName: string | undefined = 'public', name: string) {
    this.set.add(`"${schemaName}"."${name}"`);
  }
}

export const composeMigration = async (
  adapter: AdapterBase,
  config: RakeDbConfig,
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  params: ComposeMigrationParams,
): Promise<string | undefined> => {
  const { structureToAstCtx, currentSchema } = params;

  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  await processSchemas(ast, dbStructure, params);
  processExtensions(config, ast, dbStructure, params);

  const pendingDbTypes = new PendingDbTypes();

  await processDomains(
    config,
    ast,
    adapter,
    domainsMap,
    dbStructure,
    params,
    pendingDbTypes,
  );
  await processEnums(ast, dbStructure, params, pendingDbTypes);

  await processTables(
    ast,
    domainsMap,
    adapter,
    dbStructure,
    config,
    params,
    pendingDbTypes,
  );

  return astToMigration(currentSchema, config, ast);
};
