import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { ComposeMigrationParams, PendingDbTypes } from '../compose-migration';
import { RecordString } from 'pqb/internal';
import {
  AddOrRenameEnumValueQuestion,
  MigrationDecider,
  MigrationDecisionCtx,
} from '../migration-decider';

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
    internal: { generatorIgnore },
  }: ComposeMigrationParams,
  decisionCtx: MigrationDecisionCtx,
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
      await changeEnum(
        ast,
        dbEnum,
        codeEnum,
        pendingDbTypes,
        decisionCtx,
        currentSchema,
      );
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

      await changeEnum(
        ast,
        dbEnum,
        codeEnum,
        pendingDbTypes,
        decisionCtx,
        currentSchema,
      );

      continue;
    }

    dropEnums.push(dbEnum);
  }

  for (const codeEnum of createEnums) {
    if (dropEnums.length) {
      const dbEnum = await decisionCtx.decider.createOrRename({
        kind: 'enum',
        target: {
          schema: codeEnum.schema ?? currentSchema,
          name: codeEnum.name,
        },
        candidates: dropEnums,
        candidateSource: (x) => decisionCtx.dbSource(x),
        name: codeEnum.name,
        candidateName: (x) => x.name,
      });
      if (dbEnum) {
        dropEnums.splice(dropEnums.indexOf(dbEnum), 1);

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

        await changeEnum(
          ast,
          dbEnum,
          codeEnum,
          pendingDbTypes,
          decisionCtx,
          currentSchema,
        );

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
  decisionCtx: MigrationDecisionCtx,
  currentSchema: string,
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

  const enumValueChanges = await resolveEnumValueChanges(
    {
      source: decisionCtx.dbSource(dbEnum),
      target: { schema: schema ?? currentSchema, name },
      enumName: name,
    },
    dbValues,
    codeValues,
    addValues,
    dropValues,
    decisionCtx.decider,
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

const resolveEnumValueChanges = async (
  enumQuestion: Pick<
    AddOrRenameEnumValueQuestion,
    'source' | 'target' | 'enumName'
  >,
  dbValues: string[],
  codeValues: string[],
  addValues: string[],
  dropValues: string[],
  decider: MigrationDecider,
): Promise<EnumValueChanges | undefined> => {
  if (!addValues.length || !dropValues.length) return;

  const renamedValues: RecordString = {};
  const remainingDropValues = [...dropValues];

  for (const value of addValues) {
    if (remainingDropValues.length) {
      const dropValue = await decider.addOrRenameEnumValue({
        ...enumQuestion,
        value,
        candidates: remainingDropValues,
      });

      // an empty string is a valid enum value
      if (dropValue !== undefined) {
        remainingDropValues.splice(remainingDropValues.indexOf(dropValue), 1);
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
