import { IntrospectedStructure } from '../dbStructure';
import { RakeDbAst } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';

export const processSchemas = async (
  schemas: Set<string>,
  dbStructure: IntrospectedStructure,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createSchemas: string[] = [];
  const dropSchemas: string[] = [];

  for (const schema of schemas) {
    if (!dbStructure.schemas.includes(schema)) {
      createSchemas.push(schema);
    }
  }

  for (const schema of dbStructure.schemas) {
    if (!schemas.has(schema) && schema !== 'public') {
      dropSchemas.push(schema);
    }
  }

  for (const schema of createSchemas) {
    if (dropSchemas.length) {
      const index = await promptCreateOrRename('schema', schema, dropSchemas);
      if (index) {
        const from = dropSchemas[index - 1];
        dropSchemas.splice(index - 1, 1);

        renameSchemaInStructures(dbStructure.tables, from, schema);
        renameSchemaInStructures(dbStructure.views, from, schema);
        renameSchemaInStructures(dbStructure.indexes, from, schema);
        renameSchemaInStructures(dbStructure.constraints, from, schema);
        renameSchemaInStructures(dbStructure.triggers, from, schema);
        renameSchemaInStructures(dbStructure.extensions, from, schema);
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

  return ast;
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
