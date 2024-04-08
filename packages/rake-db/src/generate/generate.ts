import {
  Adapter,
  AdapterOptions,
  ColumnsShape,
  ColumnType,
  EnumColumn,
  QueryWithTable,
  TableData,
  VirtualColumn,
} from 'pqb';
import {
  AnyRakeDbConfig,
  makeFileVersion,
  RakeDbAst,
  RakeDbConfigDb,
  writeMigrationFile,
} from 'rake-db';
import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from './dbStructure';
import { astToMigration } from './astToMigration';
import { colors } from '../colors';
import { promptSelect } from '../prompt';
import {
  dbColumnToAst,
  DbStructureDomainsMap,
  getDbStructureTableData,
  getDbTableColumnsChecks,
  instantiateDbColumn,
  makeDomainsMap,
  makeStructureToAstCtx,
  StructureToAstCtx,
  tableToAst,
} from './structureToAst';
import { QueryColumn } from 'orchid-core';
import { getSchemaAndTableFromName } from '../common';

interface ActualItems {
  schemas: Set<string>;
  enums: Map<string, EnumItem>;
  tables: QueryWithTable[];
}

interface EnumItem {
  schema?: string;
  name: string;
  values: [string, ...string[]];
}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.db || !config.baseTable) throw invalidConfig(config);

  const adapters = getAdapters(options);
  const currentSchema = adapters[0].schema ?? 'public';
  const dbStructure = await migrateAndPullStructures(adapters);

  const { schemas, enums, tables } = await getActualItems(
    config.db,
    currentSchema,
  );

  const ast = await processSchemas(schemas, dbStructure);

  const enumsAst = await processEnums(enums, dbStructure, currentSchema);

  ast.push(
    ...enumsAst,
    ...(await processTables(tables, dbStructure, currentSchema, config)),
  );

  const result = astToMigration(currentSchema, config, ast);
  if (!result) return;

  const version = await makeFileVersion({}, config);
  await writeMigrationFile(config, version, 'pull', result);
};

const invalidConfig = (config: AnyRakeDbConfig) =>
  new Error(
    `\`${
      config.db ? 'baseTable' : 'db'
    }\` setting must be set in the rake-db config for the generator to work`,
  );

const getAdapters = (options: AdapterOptions[]) => {
  if (!options.length) throw new Error(`Database options must not be empty`);

  return options.map((opts) => new Adapter(opts));
};

const migrateAndPullStructures = async (adapters: Adapter[]) => {
  const dbStructures = await Promise.all(
    adapters.map(async (adapter) => {
      // TODO: migrate
      const schema = await introspectDbSchema(adapter);
      await adapter.close();
      return schema;
    }),
  );

  const dbStructure = dbStructures[0];
  for (let i = 1; i < dbStructures.length; i++) {
    deepCompare(dbStructure, dbStructures[i], i);
  }

  return dbStructure;
};

const deepCompare = (a: unknown, b: unknown, i: number, path?: string) => {
  let err: true | undefined;
  if (typeof a !== typeof b) {
    err = true;
  }

  if (!a || typeof a !== 'object') {
    if (a !== b) {
      err = true;
    }
  } else {
    if (Array.isArray(a)) {
      for (let n = 0, len = a.length; n < len; n++) {
        deepCompare(
          a[n],
          (b as unknown[])[n],
          i,
          path ? `${path}[${n}]` : String(n),
        );
      }
    } else {
      for (const key in a) {
        deepCompare(
          a[key as keyof typeof a],
          (b as Record<string, unknown>)[key],
          i,
          path ? `${path}.${key}` : key,
        );
      }
    }
  }

  if (err) {
    throw new Error(`${path} in the db 0 does not match db ${i}`);
  }
};

const createTableAst = (
  currentSchema: string,
  table: QueryWithTable,
): RakeDbAst.Table => {
  return {
    type: 'table',
    action: 'create',
    schema: table.q.schema === currentSchema ? undefined : table.q.schema,
    comment: table.internal.comment,
    name: table.table,
    shape: makeTableShape(table),
    ...(table.internal as TableData),
    noPrimaryKey: table.internal.noPrimaryKey ? 'ignore' : 'error',
  };
};

const makeTableShape = (table: QueryWithTable): ColumnsShape => {
  const shape: ColumnsShape = {};
  for (const key in table.shape) {
    const column = table.shape[key];
    if (!(column instanceof VirtualColumn)) {
      shape[key] = column as ColumnType;
    }
  }
  return shape;
};

const getActualItems = async (
  db: RakeDbConfigDb,
  currentSchema: string,
): Promise<ActualItems> => {
  const actualItems: ActualItems = {
    schemas: new Set(),
    enums: new Map(),
    tables: [],
  };

  const tableNames = new Set<string>();
  const habtmTables = new Map<string, QueryWithTable>();

  const exported = await db();
  for (const key in exported) {
    if (key[0] === '$') continue;

    const table = exported[key as keyof typeof exported];

    if (!table.table) {
      throw new Error(`Table ${key} is missing table property`);
    }

    const { schema } = table.q;
    const name = `${schema ? `${schema}.` : ''}${table.table}`;
    if (tableNames.has(name)) {
      throw new Error(
        `Table ${schema}.${table.table} is defined more than once`,
      );
    }

    tableNames.add(name);

    if (schema) actualItems.schemas.add(schema);

    actualItems.tables.push(table as QueryWithTable);

    for (const key in table.shape) {
      const column = table.shape[key];
      if (column.dataType === 'enum') {
        processEnumColumn(column, currentSchema, actualItems);
      }
    }

    for (const key in table.relations) {
      const column = table.shape[key];

      if ('joinTable' in column) {
        processHasAndBelongsToManyColumn(column, habtmTables, actualItems);
      }
    }
  }

  return actualItems;
};

const processEnumColumn = (
  column: QueryColumn,
  currentSchema: string,
  actualItems: ActualItems,
) => {
  const { enumName, options } = column as unknown as {
    enumName: string;
    options: [string, ...string[]];
  };

  const [schema, name] = getSchemaAndTableFromName(enumName);
  const enumSchema = schema ?? currentSchema;

  actualItems.enums.set(`${enumSchema}.${name}`, {
    schema: enumSchema,
    name,
    values: options,
  });
  if (schema) actualItems.schemas.add(schema);
};

const processHasAndBelongsToManyColumn = (
  column: QueryColumn & { joinTable: unknown },
  habtmTables: Map<string, QueryWithTable>,
  actualItems: ActualItems,
) => {
  const q = (column as { joinTable: QueryWithTable }).joinTable;
  const prev = habtmTables.get(q.table);
  if (prev) {
    for (const key in q.shape) {
      if (q.shape[key] !== prev.shape[key]) {
        throw new Error(
          `Column ${key} in ${q.table} in hasAndBelongsToMany relation does not match with the relation on the other side`,
        );
      }
    }
    return;
  }
  habtmTables.set(q.table, q);

  const joinTable = Object.create(q);

  const shape: ColumnsShape = {};
  for (const key in joinTable.shape) {
    const column = Object.create(joinTable.shape[key]);
    delete column.data.identity;
    delete column.data.isPrimaryKey;
    delete column.data.default;
    shape[key] = column;
  }
  joinTable.shape = shape;
  joinTable.internal.primaryKey = {
    columns: Object.keys(shape),
  };
  joinTable.internal.noPrimaryKey = false;

  actualItems.tables.push(joinTable);

  return;
};

const processSchemas = async (
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
      const index = await select('schema', schema, dropSchemas);
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

const processEnums = async (
  enums: ActualItems['enums'],
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
      // TODO: maybe change
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
        table: false,
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
      const index = await select(
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
          table: false,
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

const processTables = async (
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createTables: QueryWithTable[] = [];
  const dropTables: DbStructure.Table[] = [];

  for (const codeTable of tables) {
    const tableSchema = codeTable.q.schema ?? currentSchema;
    const dbTable = dbStructure.tables.find(
      (t) => t.name === codeTable.table && t.schemaName === tableSchema,
    );
    if (!dbTable) {
      createTables.push(codeTable);
    }
  }

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  for (const dbTable of dbStructure.tables) {
    if (dbTable.name === 'schemaMigrations') continue;

    const codeTable = tables.find(
      (t) =>
        t.table === dbTable.name &&
        (t.q.schema ?? currentSchema) === dbTable.schemaName,
    );
    if (codeTable) {
      processTableChange(
        structureToAstCtx,
        dbStructure,
        domainsMap,
        ast,
        currentSchema,
        dbTable,
        codeTable,
      );
      continue;
    }

    const i = createTables.findIndex((t) => t.table === dbTable.name);
    if (i !== -1) {
      const table = createTables[i];
      createTables.splice(i, 1);
      const fromSchema = dbTable.schemaName;
      const toSchema = table.q.schema ?? currentSchema;

      ast.push({
        type: 'renameType',
        table: true,
        fromSchema,
        from: dbTable.name,
        toSchema,
        to: dbTable.name,
      });
      continue;
    }

    dropTables.push(dbTable);
  }

  for (const codeTable of createTables) {
    if (dropTables.length) {
      const index = await select(
        'table',
        codeTable.table,
        dropTables.map((x) => x.name),
      );
      if (index) {
        const drop = dropTables[index - 1];
        dropTables.splice(index - 1, 1);

        ast.push({
          type: 'renameType',
          table: true,
          fromSchema: drop.schemaName,
          from: drop.name,
          toSchema: codeTable.q.schema ?? currentSchema,
          to: codeTable.table,
        });

        continue;
      }
    }

    ast.push(createTableAst(currentSchema, codeTable));
  }

  for (const dbTable of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, dbTable, 'drop', domainsMap),
    );
  }

  return ast;
};

const processTableChange = (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  dbTable: DbStructure.Table,
  codeTable: QueryWithTable,
) => {
  const shape: RakeDbAst.ChangeTable['shape'] = {};
  const add: TableData = {};
  const drop: TableData = {};

  const tableData = getDbStructureTableData(dbStructure, dbTable);
  const checks = getDbTableColumnsChecks(tableData);
  const dbColumns = Object.fromEntries(
    dbTable.columns.map((column) => [column.name, column]),
  );

  const columnsToChange = new Map<string, ColumnType>();

  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    // skip virtual column
    if (!column.dataType) continue;

    const name = column.data.name ?? key;
    if (dbColumns[name]) {
      columnsToChange.set(name, column);
      continue;
    }

    shape[name] = {
      type: 'add',
      item: column,
    };
  }

  for (const name in dbColumns) {
    if (columnsToChange.has(name)) continue;

    const [key, column] = dbColumnToAst(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      dbTable.name,
      dbColumns[name],
      dbTable,
      tableData,
      checks,
    );

    shape[key] = {
      type: 'drop',
      item: column,
    };
  }

  for (const [name, codeColumn] of columnsToChange) {
    const dbColumnStructure = dbColumns[name];

    let changed = false;

    const dbColumn = instantiateDbColumn(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      dbColumnStructure,
    );

    const dbType = getColumnType(dbColumn, currentSchema);
    const codeType = getColumnType(codeColumn, currentSchema);
    if (dbType !== codeType) {
      changed = true;
    }

    if (changed) {
      shape[name] = {
        type: 'change',
        from: { column: dbColumn },
        to: { column: codeColumn },
      };
    }
  }

  if (
    Object.keys(shape).length ||
    Object.keys(add).length ||
    Object.keys(drop).length
  ) {
    ast.push({
      type: 'changeTable',
      schema: codeTable.q.schema ?? currentSchema,
      name: codeTable.table,
      shape,
      add,
      drop,
    });
  }
};

const getColumnType = (column: ColumnType, currentSchema: string) => {
  if (column instanceof EnumColumn) {
    const [schema = currentSchema, name] = getSchemaAndTableFromName(
      column.enumName,
    );
    return (column.enumName = `${schema}.${name}`);
  } else {
    return column.dataType;
  }
};

const select = (
  kind: string,
  name: string,
  drop: string[],
): Promise<number> => {
  let max = 0;
  const add = name.length + 3;
  for (const name of drop) {
    if (name.length + add > max) {
      max = name.length + add;
    }
  }

  const renameMessage = `rename ${name}`;

  return promptSelect({
    message: `Create or rename ${colors.blueBold(
      name,
    )} ${kind} from another ${kind}?`,
    options: [
      `${colors.greenBold('+')} ${name} ${colors
        .pale('create name')
        .padStart(max + renameMessage.length - name.length, ' ')}`,
      ...drop.map(
        (d) =>
          `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
            '>',
          )} ${name} ${colors
            .pale(renameMessage)
            .padStart(max + renameMessage.length - d.length - add, ' ')}`,
      ),
    ],
  });
};
