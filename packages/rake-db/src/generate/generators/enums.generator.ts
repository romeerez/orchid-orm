import { DbStructure, IntrospectedStructure } from '../dbStructure';
import { RakeDbAst } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';

export interface EnumItem {
  schema?: string;
  name: string;
  values: [string, ...string[]];
}

export const processEnums = async (
  enums: Map<string, EnumItem>,
  dbStructure: IntrospectedStructure,
  currentSchema: string,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createEnums: EnumItem[] = [];
  const dropEnums: DbStructure.Enum[] = [];

  for (const [, codeEnum] of enums) {
    const { schema = currentSchema, name } = codeEnum;
    const dbEnum = dbStructure.enums.find(
      (x) => x.schemaName === schema && x.name === name,
    );
    if (!dbEnum) {
      createEnums.push(codeEnum);
    }
  }

  for (const dbEnum of dbStructure.enums) {
    const codeEnum = enums.get(`${dbEnum.schemaName}.${dbEnum.name}`);
    if (codeEnum) {
      const { values: dbValues } = dbEnum;
      const { values: codeValues } = codeEnum;

      if (dbValues.length < codeValues.length) {
        if (!dbValues.some((value, i) => value !== codeValues[i])) {
          ast.push({
            type: 'enumValues',
            action: 'add',
            schema: dbEnum.schemaName,
            name: dbEnum.name,
            values: codeValues.slice(-(codeValues.length - dbValues.length)),
          });
          continue;
        }
      } else if (dbValues.length > codeValues.length) {
        if (!codeValues.some((value, i) => value !== dbValues[i])) {
          ast.push({
            type: 'enumValues',
            action: 'drop',
            schema: dbEnum.schemaName,
            name: dbEnum.name,
            values: dbValues.slice(-(dbValues.length - codeValues.length)),
          });
          continue;
        }
      } else if (!dbValues.some((value, i) => value !== codeValues[i])) {
        continue;
      }

      ast.push({
        type: 'changeEnumValues',
        schema: dbEnum.schemaName,
        name: dbEnum.name,
        fromValues: dbValues,
        toValues: codeValues,
      });

      continue;
    }

    const i = createEnums.findIndex((x) => x.name === dbEnum.name);
    if (i !== -1) {
      const item = createEnums[i];
      createEnums.splice(i, 1);
      const fromSchema = dbEnum.schemaName;
      const toSchema = item.schema ?? currentSchema;

      renameColumnsTypeSchema(dbStructure, fromSchema, toSchema);

      ast.push({
        type: 'renameType',
        kind: 'TYPE',
        fromSchema,
        from: dbEnum.name,
        toSchema,
        to: dbEnum.name,
      });
      continue;
    }

    dropEnums.push(dbEnum);
  }

  for (const codeEnum of createEnums) {
    if (dropEnums.length) {
      const index = await promptCreateOrRename(
        'enum',
        codeEnum.name,
        dropEnums.map((x) => x.name),
      );
      if (index) {
        const drop = dropEnums[index - 1];
        dropEnums.splice(index - 1, 1);

        const fromSchema = drop.schemaName;
        const from = drop.name;
        const toSchema = codeEnum.schema ?? currentSchema;
        const to = codeEnum.name;

        if (fromSchema !== toSchema) {
          renameColumnsTypeSchema(dbStructure, fromSchema, toSchema);
        }

        for (const table of dbStructure.tables) {
          for (const column of table.columns) {
            if (column.type === from) {
              column.type = to;
            }
          }
        }

        ast.push({
          type: 'renameType',
          kind: 'TYPE',
          fromSchema,
          from,
          toSchema,
          to,
        });

        continue;
      }
    }

    ast.push({
      type: 'enum',
      action: 'create',
      ...codeEnum,
    });
  }

  for (const dbEnum of dropEnums) {
    ast.push({
      type: 'enum',
      action: 'drop',
      schema: dbEnum.schemaName,
      name: dbEnum.name,
      values: dbEnum.values,
    });
  }

  return ast;
};

const renameColumnsTypeSchema = (
  dbStructure: IntrospectedStructure,
  from: string,
  to: string,
) => {
  for (const table of dbStructure.tables) {
    for (const column of table.columns) {
      if (column.typeSchema === from) {
        column.typeSchema = to;
      }
    }
  }
};
