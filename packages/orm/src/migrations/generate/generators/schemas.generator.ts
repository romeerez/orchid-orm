import { RakeDbAst, IntrospectedStructure } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';
import { ComposeMigrationParams } from '../composeMigration';

export const processSchemas = async (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  {
    codeItems: { schemas },
    verifying,
    internal: { generatorIgnore },
    currentSchema,
  }: ComposeMigrationParams,
): Promise<void> => {
  const createSchemas: string[] = [];
  const dropSchemas: string[] = [];

  for (const schema of schemas) {
    if (!dbStructure.schemas.includes(schema)) {
      createSchemas.push(schema);
    }
  }

  for (const schema of dbStructure.schemas) {
    if (
      !schemas.has(schema) &&
      schema !== 'public' &&
      schema !== currentSchema &&
      !generatorIgnore?.schemas?.includes(schema)
    ) {
      dropSchemas.push(schema);
    }
  }

  for (const schema of createSchemas) {
    if (dropSchemas.length) {
      const i = await promptCreateOrRename(
        'schema',
        schema,
        dropSchemas,
        verifying,
      );
      if (i) {
        const from = dropSchemas[i - 1];
        dropSchemas.splice(i - 1, 1);

        renameSchemaInStructures(dbStructure.tables, from, schema);
        renameSchemaInStructures(dbStructure.views, from, schema);
        renameSchemaInStructures(dbStructure.indexes, from, schema);
        renameSchemaInStructures(dbStructure.excludes, from, schema);
        renameSchemaInStructures(dbStructure.constraints, from, schema);
        renameSchemaInStructures(dbStructure.triggers, from, schema);
        renameSchemaInStructures(dbStructure.enums, from, schema);
        renameSchemaInStructures(dbStructure.domains, from, schema);
        renameSchemaInStructures(dbStructure.collations, from, schema);

        for (const table of dbStructure.tables) {
          for (const column of table.columns) {
            if (column.typeSchema === from) {
              column.typeSchema = schema;
            }
          }
        }

        ast.push({
          type: 'renameSchema',
          from,
          to: schema,
        });
        continue;
      }
    }

    ast.push({
      type: 'schema',
      action: 'create',
      name: schema,
    });
  }

  for (const schema of dropSchemas) {
    ast.push({
      type: 'schema',
      action: 'drop',
      name: schema,
    });
  }
};

const renameSchemaInStructures = (
  items: { schemaName: string }[],
  from: string,
  to: string,
) => {
  for (const item of items) {
    if (item.schemaName === from) {
      item.schemaName = to;
    }
  }
};
