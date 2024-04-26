import {
  Adapter,
  AdapterOptions,
  ColumnsShape,
  DbExtension,
  QueryWithTable,
} from 'pqb';
import {
  AnyRakeDbConfig,
  makeFileVersion,
  RakeDbAst,
  RakeDbConfigDb,
  writeMigrationFile,
} from 'rake-db';
import { introspectDbSchema } from './dbStructure';
import { astToMigration } from './astToMigration';
import { QueryColumn } from 'orchid-core';
import { getSchemaAndTableFromName } from '../common';
import { processSchemas } from './generators/schemas.generator';
import { EnumItem, processEnums } from './generators/enums.generator';
import { processTables } from './generators/tables.generator';
import { processExtensions } from './generators/extensions.generator';

interface ActualItems {
  schemas: Set<string>;
  enums: Map<string, EnumItem>;
  tables: QueryWithTable[];
  extensions?: DbExtension[];
}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.db || !config.baseTable) throw invalidConfig(config);

  const adapters = getAdapters(options);
  const currentSchema = adapters[0].schema ?? 'public';
  const dbStructure = await migrateAndPullStructures(adapters);

  const { schemas, enums, tables, extensions } = await getActualItems(
    config.db,
    currentSchema,
  );

  const ast: RakeDbAst[] = [];
  await processSchemas(ast, schemas, dbStructure);
  processExtensions(ast, dbStructure, currentSchema, extensions);
  await processEnums(ast, enums, dbStructure, currentSchema);
  await processTables(
    ast,
    adapters[0],
    tables,
    dbStructure,
    currentSchema,
    config,
  );

  await Promise.all(adapters.map((x) => x.close()));

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
    compareDbStructures(dbStructure, dbStructures[i], i);
  }

  return dbStructure;
};

const compareDbStructures = (
  a: unknown,
  b: unknown,
  i: number,
  path?: string,
) => {
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
        compareDbStructures(
          a[n],
          (b as unknown[])[n],
          i,
          path ? `${path}[${n}]` : String(n),
        );
      }
    } else {
      for (const key in a) {
        compareDbStructures(
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

const getActualItems = async (
  db: RakeDbConfigDb,
  currentSchema: string,
): Promise<ActualItems> => {
  const tableNames = new Set<string>();
  const habtmTables = new Map<string, QueryWithTable>();
  const exported = await db();

  const actualItems: ActualItems = {
    schemas: new Set(),
    enums: new Map(),
    tables: [],
    extensions: exported.$queryBuilder.internal.extensions,
  };

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

    for (const key in table.relations) {
      const column = table.shape[key];

      if ('joinTable' in column) {
        processHasAndBelongsToManyColumn(column, habtmTables, actualItems);
      }
    }

    for (const key in table.shape) {
      const column = table.shape[key];
      if (!column.dataType) {
        // delete virtual columns to not confuse column generators
        delete table.shape[key];
      } else if (column.dataType === 'enum') {
        processEnumColumn(column, currentSchema, actualItems);
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
    column.data = {
      ...column.data,
      identity: undefined,
      isPrimaryKey: undefined,
      default: undefined,
    };
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
