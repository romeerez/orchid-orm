import {
  RakeDbAst,
  IntrospectedStructure,
  getSchemaAndTableFromName,
  RakeDbConfig,
} from 'rake-db';
import { ComposeMigrationParams } from '../composeMigration';

interface Extension {
  schema?: string;
  name: string;
  version?: string;
}

export const processExtensions = (
  config: RakeDbConfig,
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  {
    currentSchema,
    internal: { extensions, generatorIgnore },
  }: ComposeMigrationParams,
) => {
  const codeExtensions = extensions?.map((ext): Extension => {
    const [schema, name] = getSchemaAndTableFromName(config, ext.name);
    return { schema, name, version: ext.version };
  });

  for (const dbExt of dbStructure.extensions) {
    if (
      generatorIgnore?.schemas?.includes(dbExt.schemaName) ||
      generatorIgnore?.extensions?.includes(dbExt.name)
    ) {
      continue;
    }

    if (codeExtensions) {
      let found = false;
      for (let i = 0; i < codeExtensions.length; i++) {
        const codeExt = codeExtensions[i];
        if (
          dbExt.name === codeExt.name &&
          dbExt.schemaName === (codeExt.schema ?? currentSchema) &&
          (!codeExt.version || codeExt.version === dbExt.version)
        ) {
          found = true;
          codeExtensions.splice(i, 1);
          break;
        }
      }

      if (found) continue;
    }

    ast.push({
      type: 'extension',
      action: 'drop',
      schema: dbExt.schemaName === currentSchema ? undefined : dbExt.schemaName,
      name: dbExt.name,
      version: dbExt.version,
    });
  }

  if (codeExtensions?.length) {
    ast.push(
      ...codeExtensions.map((ext) => ({
        type: 'extension' as const,
        action: 'create' as const,
        ...ext,
      })),
    );
  }
};
