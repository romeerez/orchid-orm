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
import { introspectDbSchema, IntrospectedStructure } from './dbStructure';
import { astToMigration } from './astToMigration';
import { colors } from '../colors';
import { promptSelect } from '../prompt';
import {
  makeDomainsMap,
  makeStructureToAstCtx,
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
    ...processTables(tables, dbStructure, currentSchema, config, renameSchemas),
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

  const exported = await db();
  for (const key in exported) {
    const table = exported[key as keyof typeof exported];
    if (!(table instanceof baseTable)) continue;

    if (!table.table) {
      throw new Error(
        `Table ${table.constructor.name} is missing table property`,
      );
    }

    if (table.q.schema) actualItems.schemas.add(table.q.schema);

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
      let max = 0;
      const add = schema.length + 3;
      for (const schema of dropSchemas) {
        if (schema.length + add > max) {
          max = schema.length + add;
        }
      }

      const index = await promptSelect({
        message: `Create or rename ${colors.blueBold(
          schema,
        )} schema from another schema?`,
        options: [
          `${colors.greenBold('+')} ${schema} ${colors
            .pale('create schema')
            .padStart(max + 13 - schema.length, ' ')}`,
          ...dropSchemas.map(
            (d) =>
              `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
                '>',
              )} ${schema} ${colors
                .pale('rename schema')
                .padStart(max + 13 - d.length - add, ' ')}`,
          ),
        ],
      });

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

const processTables = (
  tables: Table[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
  renameSchemas: Map<string, string>,
): RakeDbAst[] => {
  const ast: RakeDbAst[] = [];
  const createTables: Table[] = [];

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
    if (
      table.name === 'schemaMigrations' ||
      tables.some(
        (t) =>
          t.table === table.name &&
          (t.schema ?? currentSchema) === table.schemaName,
      )
    )
      continue;

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

    ast.push(
      tableToAst(structureToAstCtx, dbStructure, table, 'drop', domainsMap),
    );
  }

  ast.push(
    ...[...createTables.values()].map((table) =>
      createTableAst(currentSchema, table),
    ),
  );

  return ast;
};
