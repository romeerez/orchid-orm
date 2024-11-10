import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';

export interface EnumItem {
  schema?: string;
  name: string;
  values: [string, ...string[]];
}

export const processEnums = async (
  ast: RakeDbAst[],
  enums: Map<string, EnumItem>,
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  verifying: boolean | undefined,
): Promise<void> => {
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
      changeEnum(ast, dbEnum, codeEnum);
      continue;
    }

    const i = createEnums.findIndex((x) => x.name === dbEnum.name);
    if (i !== -1) {
      const codeEnum = createEnums[i];
      createEnums.splice(i, 1);
      const fromSchema = dbEnum.schemaName;
      const toSchema = codeEnum.schema ?? currentSchema;

      renameColumnsTypeSchema(dbStructure, fromSchema, toSchema);

      ast.push({
        type: 'renameType',
        kind: 'TYPE',
        fromSchema,
        from: dbEnum.name,
        toSchema,
        to: dbEnum.name,
      });

      changeEnum(ast, dbEnum, codeEnum);

      continue;
    }

    dropEnums.push(dbEnum);
  }

  for (const codeEnum of createEnums) {
    if (dropEnums.length) {
      const i = await promptCreateOrRename(
        'enum',
        codeEnum.name,
        dropEnums.map((x) => x.name),
        verifying,
      );
      if (i) {
        const dbEnum = dropEnums[i - 1];
        dropEnums.splice(i - 1, 1);

        const fromSchema = dbEnum.schemaName;
        const from = dbEnum.name;
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

        changeEnum(ast, dbEnum, codeEnum);

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
};

const changeEnum = (
  ast: RakeDbAst[],
  dbEnum: DbStructure.Enum,
  codeEnum: EnumItem,
) => {
  const { values: dbValues } = dbEnum;
  const { values: codeValues, schema, name } = codeEnum;

  if (dbValues.length < codeValues.length) {
    if (!dbValues.some((value, i) => value !== codeValues[i])) {
      ast.push({
        type: 'enumValues',
        action: 'add',
        schema,
        name,
        values: codeValues.slice(-(codeValues.length - dbValues.length)),
      });
      return;
    }
  } else if (dbValues.length > codeValues.length) {
    if (!codeValues.some((value, i) => value !== dbValues[i])) {
      ast.push({
        type: 'enumValues',
        action: 'drop',
        schema,
        name,
        values: dbValues.slice(-(dbValues.length - codeValues.length)),
      });
      return;
    }
  } else if (!dbValues.some((value, i) => value !== codeValues[i])) {
    return;
  }

  ast.push({
    type: 'changeEnumValues',
    schema,
    name,
    fromValues: dbValues,
    toValues: codeValues,
  });
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
