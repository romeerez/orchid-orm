import {
  DbStructure,
  IntrospectedStructure,
  promptSelect,
  RakeDbAst,
} from 'rake-db';
import { promptCreateOrRename } from './generators.utils';
import { ComposeMigrationParams, PendingDbTypes } from '../compose-migration';
import { colors, RecordString } from 'pqb/internal';
import { AbortSignal } from '../generate';

export interface EnumItem {
  schema?: string;
  name: string;
  values: [string, ...string[]];
}

export const processEnums = async (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  {
    codeItems: { enums },
    currentSchema,
    verifying,
    internal: { generatorIgnore },
  }: ComposeMigrationParams,
  pendingDbTypes: PendingDbTypes,
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
    if (
      generatorIgnore?.schemas?.includes(dbEnum.schemaName) ||
      generatorIgnore?.enums?.includes(dbEnum.name)
    ) {
      continue;
    }

    const codeEnum = enums.get(`${dbEnum.schemaName}.${dbEnum.name}`);
    if (codeEnum) {
      await changeEnum(ast, dbEnum, codeEnum, pendingDbTypes, verifying);
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
      pendingDbTypes.add(toSchema, dbEnum.name);

      await changeEnum(ast, dbEnum, codeEnum, pendingDbTypes, verifying);

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
        pendingDbTypes.add(toSchema, to);

        await changeEnum(ast, dbEnum, codeEnum, pendingDbTypes, verifying);

        continue;
      }
    }

    ast.push({
      type: 'enum',
      action: 'create',
      ...codeEnum,
    });
    pendingDbTypes.add(codeEnum.schema, codeEnum.name);
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

const changeEnum = async (
  ast: RakeDbAst[],
  dbEnum: DbStructure.Enum,
  codeEnum: EnumItem,
  pendingDbTypes: PendingDbTypes,
  verifying: boolean | undefined,
) => {
  const { values: dbValues } = dbEnum;
  const { values: codeValues, schema, name } = codeEnum;
  const addValues = codeValues.filter((value) => !dbValues.includes(value));
  const dropValues = dbValues.filter((value) => !codeValues.includes(value));

  if (dbValues.length < codeValues.length) {
    if (!dropValues.length) {
      ast.push({
        type: 'enumValues',
        action: 'add',
        schema,
        name,
        values: addValues,
      });
      pendingDbTypes.add(schema, name);
      return;
    }
  } else if (dbValues.length > codeValues.length) {
    if (!addValues.length) {
      ast.push({
        type: 'enumValues',
        action: 'drop',
        schema,
        name,
        values: dropValues,
      });
      pendingDbTypes.add(schema, name);
      return;
    }
  } else if (!dropValues.length) {
    return;
  }

  const enumValueChanges = await promptEnumValueChanges(
    name,
    dbValues,
    codeValues,
    addValues,
    dropValues,
    verifying,
  );
  if (enumValueChanges) {
    let changed = false;

    if (Object.keys(enumValueChanges.renamedValues).length) {
      ast.push({
        type: 'renameEnumValues',
        schema,
        name,
        values: enumValueChanges.renamedValues,
      });
      changed = true;
    }

    if (enumValueChanges.fromValues) {
      ast.push({
        type: 'changeEnumValues',
        schema,
        name,
        fromValues: enumValueChanges.fromValues,
        toValues: enumValueChanges.toValues,
      });
      changed = true;
    }

    if (changed) {
      pendingDbTypes.add(schema, name);
      return;
    }
  }

  ast.push({
    type: 'changeEnumValues',
    schema,
    name,
    fromValues: dbValues,
    toValues: codeValues,
  });
  pendingDbTypes.add(schema, name);
};

interface EnumValueChanges {
  renamedValues: RecordString;
  fromValues?: string[];
  toValues: string[];
}

const promptEnumValueChanges = async (
  enumName: string,
  dbValues: string[],
  codeValues: string[],
  addValues: string[],
  dropValues: string[],
  verifying: boolean | undefined,
): Promise<EnumValueChanges | undefined> => {
  if (!addValues.length || !dropValues.length) return;

  const renamedValues: RecordString = {};
  const remainingDropValues = [...dropValues];

  for (const value of addValues) {
    if (remainingDropValues.length) {
      if (verifying) throw new AbortSignal();

      const i = await promptSelect({
        message: `Add or rename ${colors.blueBold(
          value,
        )} enum value in ${colors.blueBold(enumName)}?`,
        options: [
          `${colors.greenBold('+')} ${value}  ${colors.pale('add enum value')}`,
          ...remainingDropValues.map(
            (dropValue) =>
              `${colors.yellowBold('~')} ${dropValue} ${colors.yellowBold(
                '=>',
              )} ${value}  ${colors.pale('rename enum value')}`,
          ),
        ],
      });

      if (i) {
        const dropValue = remainingDropValues[i - 1];
        remainingDropValues.splice(i - 1, 1);
        renamedValues[dropValue] = value;
      }
    }
  }

  const fromValues = dbValues.map((value) => renamedValues[value] ?? value);
  const toValues = codeValues;

  return fromValues.some((value, i) => value !== toValues[i])
    ? { renamedValues, fromValues, toValues }
    : { renamedValues, toValues };
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
