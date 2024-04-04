import {
  Adapter,
  AdapterOptions,
  ColumnsShape,
  ColumnType,
  QueryWithTable,
  TableData,
  VirtualColumn,
} from 'pqb';
import {
  AnyRakeDbConfig,
  makeFileVersion,
  RakeDbAst,
  RakeDbBaseTable,
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
  DbStructureDomainsMap,
  getDbStructureTableData,
  makeDbStructureColumnsShape,
  makeDomainsMap,
  makeStructureToAstCtx,
  StructureToAstCtx,
  tableToAst,
} from './structureToAst';

interface Table extends QueryWithTable {
  schema?: string;
}

interface ActualItems {
  schemas: Set<string>;
  tables: Table[];
}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.db || !config.baseTable) throw invalidConfig(config);

  const adapters = getAdapters(options);
  const currentSchema = adapters[0].schema ?? 'public';
  const dbStructure = await migrateAndPullStructures(adapters);

  const { schemas, tables } = await getActualItems(config.db, config.baseTable);

  const [ast, renameSchemas] = await processSchemas(schemas, dbStructure);

  ast.push(
    ...(await processTables(
      tables,
      dbStructure,
      currentSchema,
      config,
      renameSchemas,
    )),
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
  table: Table,
): RakeDbAst.Table => {
  return {
    type: 'table',
    action: 'create',
    schema: table.schema === currentSchema ? undefined : table.schema,
    comment: (table as { comment?: string }).comment,
    name: table.table,
    shape: makeTableShape(table),
    noPrimaryKey: (table as { noPrimaryKey?: boolean }).noPrimaryKey
      ? 'ignore'
      : 'error',
    ...(table.internal as TableData),
  };
};

const makeTableShape = (table: Table): ColumnsShape => {
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
  baseTable: RakeDbBaseTable<unknown>,
): Promise<ActualItems> => {
  const actualItems: ActualItems = {
    schemas: new Set(),
    tables: [],
  };

  const tableNames = new Set<string>();

  const exported = await db();
  for (const key in exported) {
    const table = exported[key as keyof typeof exported];
    if (!(table instanceof baseTable)) continue;

    if (!table.table) {
      throw new Error(
        `Table ${table.constructor.name} is missing table property`,
      );
    }

    const { schema } = table.q;
    const name = `${schema ? schema : `${schema}.`}${table.table}`;
    if (tableNames.has(name)) {
      throw new Error(
        `Table ${schema}.${table.table} is defined more than once`,
      );
    }

    tableNames.add(name);

    if (schema) actualItems.schemas.add(schema);

    actualItems.tables.push(table as Table);
  }

  return actualItems;
};

const processSchemas = async (
  schemas: Set<string>,
  dbStructure: IntrospectedStructure,
): Promise<[schemasAst: RakeDbAst[], renameSchemas: Map<string, string>]> => {
  const ast: RakeDbAst[] = [];
  const createSchemas: string[] = [];
  const dropSchemas: string[] = [];
  const renameSchemas = new Map<string, string>();

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
        renameSchemas.set(from, schema);
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

  return [ast, renameSchemas];
};

const processTables = async (
  tables: Table[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
  renameSchemas: Map<string, string>,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createTables: Table[] = [];
  const dropTables: DbStructure.Table[] = [];

  for (const table of tables) {
    const tableSchema = table.schema ?? currentSchema;
    const stored = dbStructure.tables.find(
      (t) => t.name === table.table && t.schemaName === tableSchema,
    );
    if (!stored) {
      createTables.push(table);
    }
  }

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  for (const table of dbStructure.tables) {
    if (table.name === 'schemaMigrations') continue;

    const codeTable = tables.find(
      (t) =>
        t.table === table.name &&
        (t.schema ?? currentSchema) === table.schemaName,
    );
    if (codeTable) {
      processTableChange(
        structureToAstCtx,
        dbStructure,
        domainsMap,
        ast,
        currentSchema,
        table,
        codeTable,
      );
      continue;
    }

    const i = createTables.findIndex((t) => t.table === table.name);
    if (i !== -1) {
      const tableToCreate = createTables[i];
      createTables.splice(i, 1);
      const fromSchema = table.schemaName;
      const toSchema = tableToCreate.schema ?? currentSchema;
      if (renameSchemas.get(fromSchema) === toSchema) continue;

      ast.push({
        type: 'renameTable',
        fromSchema,
        from: table.name,
        toSchema,
        to: table.name,
      });
      continue;
    }

    dropTables.push(table);
  }

  for (const table of createTables) {
    if (dropTables.length) {
      const index = await select(
        'table',
        table.table,
        dropTables.map((table) => table.name),
      );
      if (index) {
        const drop = dropTables[index - 1];
        dropTables.splice(index - 1, 1);

        ast.push({
          type: 'renameTable',
          fromSchema: drop.schemaName,
          from: drop.name,
          toSchema: table.schema ?? currentSchema,
          to: table.table,
        });

        continue;
      }
    }

    ast.push(createTableAst(currentSchema, table));
  }

  for (const table of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, table, 'drop', domainsMap),
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
  codeTable: Table,
) => {
  const shape: RakeDbAst.ChangeTable['shape'] = {};
  const add: TableData = {};
  const drop: TableData = {};

  const tableData = getDbStructureTableData(dbStructure, dbTable);
  const dbColumns = makeDbStructureColumnsShape(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    dbTable,
    tableData,
  );

  const columnsToChange = new Set<string>();

  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    const name = column.data.name ?? key;
    if (dbColumns[name]) {
      columnsToChange.add(name);
      continue;
    }

    shape[name] = {
      type: 'add',
      item: column,
    };
  }

  for (const name in dbColumns) {
    if (columnsToChange.has(name)) continue;

    shape[name] = {
      type: 'drop',
      item: dbColumns[name],
    };
  }

  if (
    Object.keys(shape).length ||
    Object.keys(add).length ||
    Object.keys(drop).length
  ) {
    ast.push({
      type: 'changeTable',
      schema: codeTable.schema ?? currentSchema,
      name: codeTable.table,
      shape,
      add,
      drop,
    });
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
