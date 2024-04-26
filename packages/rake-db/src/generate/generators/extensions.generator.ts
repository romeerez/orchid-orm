import { RakeDbAst } from 'rake-db';
import { IntrospectedStructure } from '../dbStructure';
import { DbExtension } from 'pqb';
import { getSchemaAndTableFromName } from '../../common';

interface Extention {
  schema?: string;
  name: string;
  version?: string;
}

export const processExtensions = (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  extensions?: DbExtension[],
) => {
  const codeExtensions = extensions?.map((ext): Extention => {
    const [schema, name] = getSchemaAndTableFromName(ext.name);
    return { schema, name, version: ext.version };
  });

  for (const dbExt of dbStructure.extensions) {
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
      schema: dbExt.schemaName,
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
