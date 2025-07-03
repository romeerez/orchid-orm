import { PickQueryShape, QueryColumn, toCamelCase } from 'orchid-core';
import {
  Adapter,
  AdapterOptions,
  ArrayColumn,
  ColumnsShape,
  ColumnType,
  defaultSchemaConfig,
  DomainColumn,
  PickQueryInternal,
  PickQueryQ,
  Query,
  QueryInternal,
  UnknownColumn,
} from 'pqb';
import {
  AnyRakeDbConfig,
  concatSchemaAndName,
  getSchemaAndTableFromName,
  introspectDbSchema,
  IntrospectedStructure,
  makeFileVersion,
  makeStructureToAstCtx,
  migrate,
  RakeDbAst,
  writeMigrationFile,
} from 'rake-db';
import { EnumItem } from './generators/enums.generator';
import { CodeDomain } from './generators/domains.generator';
import { composeMigration, ComposeMigrationParams } from './composeMigration';
import { verifyMigration } from './verifyMigration';
import { report } from './reportGeneratedMigration';
import path from 'node:path';
import { pathToFileURL } from 'url';

export interface CodeTable
  extends PickQueryQ,
    PickQueryShape,
    PickQueryInternal {
  table: string;
}

export interface CodeItems {
  schemas: Set<string>;
  enums: Map<string, EnumItem>;
  tables: CodeTable[];
  domains: CodeDomain[];
}

interface AfterPull {
  adapter: Adapter;
  version: string;
}

export interface DbInstance {
  $qb: Query;
}

export class AbortSignal extends Error {}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
  args: string[],
  afterPull?: AfterPull,
): Promise<void> => {
  let { dbPath } = config;
  if (!dbPath || !config.baseTable) throw invalidConfig(config);
  if (!options.length) throw new Error(`Database options must not be empty`);

  if (!dbPath.endsWith('.ts')) dbPath += '.ts';

  let migrationName = args[0] ?? 'generated';
  let up: boolean;
  if (migrationName === 'up') {
    up = true;
    migrationName = 'generated';
  } else {
    up = args[1] === 'up';
  }

  const { dbStructure, adapters } = await migrateAndPullStructures(
    options,
    config,
    afterPull,
  );

  const [adapter] = adapters;
  const currentSchema = adapter.schema ?? 'public';

  const db = await getDbFromConfig(config, dbPath);
  const { columnTypes, internal } = db.$qb;

  const codeItems = await getActualItems(
    db,
    currentSchema,
    internal,
    columnTypes,
  );

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);

  const generateMigrationParams: ComposeMigrationParams = {
    structureToAstCtx,
    codeItems,
    currentSchema,
    internal,
  };

  const ast: RakeDbAst[] = [];

  let migrationCode;
  try {
    migrationCode = await composeMigration(
      adapter,
      config,
      ast,
      dbStructure,
      generateMigrationParams,
    );
  } catch (err) {
    if (err instanceof AbortSignal) {
      await closeAdapters(adapters);
      return;
    }
    throw err;
  }

  if (migrationCode && !afterPull) {
    const result = await verifyMigration(
      adapter,
      config,
      migrationCode,
      generateMigrationParams,
    );

    if (result !== undefined) {
      throw new Error(
        `Failed to verify generated migration: some of database changes were not applied properly. This is a bug, please open an issue, attach the following migration code:\n${migrationCode}${
          result === false ? '' : `\nAfter applying:\n${result}`
        }`,
      );
    }
  }

  const { logger } = config;

  if ((!up || !migrationCode) && !afterPull) await closeAdapters(adapters);

  if (!migrationCode) {
    logger?.log('No changes were detected');
    return;
  }

  const version = afterPull?.version ?? (await makeFileVersion({}, config));

  const delayLog: string[] = [];
  await writeMigrationFile(
    {
      ...config,
      logger: logger ? { ...logger, log: (msg) => delayLog.push(msg) } : logger,
    },
    version,
    migrationName,
    migrationCode,
  );

  report(ast, config, currentSchema);

  if (logger) {
    for (const msg of delayLog) {
      logger.log(`\n${msg}`);
    }
  }

  if (up) {
    await migrate({}, options, config, undefined, adapters);
  } else if (!afterPull) {
    await closeAdapters(adapters);
  }
};

const invalidConfig = (config: AnyRakeDbConfig) =>
  new Error(
    `\`${
      config.dbPath ? 'baseTable' : 'dbPath'
    }\` setting must be set in the migrations config for the generator to work`,
  );

const getDbFromConfig = async (
  config: AnyRakeDbConfig,
  dbPath: string,
): Promise<DbInstance> => {
  const module = await config.import(
    pathToFileURL(path.resolve(config.basePath, dbPath)).toString(),
  );
  const db = (module as { [K: string]: DbInstance })[
    config.dbExportedAs ?? 'db'
  ];
  if (!db?.$qb) {
    throw new Error(
      `Unable to import OrchidORM instance as ${
        config.dbExportedAs ?? 'db'
      } from ${config.dbPath}`,
    );
  }
  return db;
};

const migrateAndPullStructures = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
  afterPull?: AfterPull,
): Promise<{ dbStructure: IntrospectedStructure; adapters: Adapter[] }> => {
  if (afterPull) {
    return {
      dbStructure: {
        schemas: [],
        tables: [],
        views: [],
        indexes: [],
        excludes: [],
        constraints: [],
        triggers: [],
        extensions: [],
        enums: [],
        domains: [],
        collations: [],
      },
      adapters: [afterPull.adapter],
    };
  }

  const adapters = await migrate(
    {},
    options,
    config,
    undefined,
    undefined,
    true,
  );

  const dbStructures = await Promise.all(
    adapters.map((adapter) => introspectDbSchema(adapter)),
  );

  const dbStructure = dbStructures[0];
  for (let i = 1; i < dbStructures.length; i++) {
    compareDbStructures(dbStructure, dbStructures[i], i);
  }

  return { dbStructure, adapters };
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
  db: DbInstance,
  currentSchema: string,
  internal: QueryInternal,
  columnTypes: unknown,
): Promise<CodeItems> => {
  const tableNames = new Set<string>();
  const habtmTables = new Map<string, CodeTable>();

  const codeItems: CodeItems = {
    schemas: new Set(undefined),
    enums: new Map(),
    tables: [],
    domains: [],
  };

  const domains = new Map<string, CodeDomain>();

  for (const key in db) {
    if (key[0] === '$') continue;

    const table = db[key as keyof typeof db] as Query;

    if (!table.table) {
      throw new Error(`Table ${key} is missing table property`);
    }

    const { schema } = table.q;
    const name = concatSchemaAndName({ schema, name: table.table });
    if (tableNames.has(name)) {
      throw new Error(`Table ${name} is defined more than once`);
    }

    tableNames.add(name);

    if (schema) codeItems.schemas.add(schema);

    codeItems.tables.push(table as never);

    for (const key in table.relations) {
      const column = table.shape[key];
      // column won't be set for has and belongs to many
      if (column && 'joinTable' in column) {
        processHasAndBelongsToManyColumn(column, habtmTables, codeItems);
      }
    }

    for (const key in table.shape) {
      const column = table.shape[key] as ColumnType;
      // remove computed columns from the shape
      if (column.data.computed) {
        delete table.shape[key];
      } else if (column instanceof DomainColumn) {
        const [schemaName = currentSchema, name] = getSchemaAndTableFromName(
          column.dataType,
        );
        domains.set(column.dataType, {
          schemaName,
          name,
          column: (column.data.as ??
            new UnknownColumn(defaultSchemaConfig)) as ColumnType,
        });
      } else {
        const en =
          column.dataType === 'enum'
            ? column
            : column instanceof ArrayColumn &&
              column.data.item.dataType === 'enum'
            ? column.data.item
            : undefined;

        if (en) {
          processEnumColumn(en, currentSchema, codeItems);
        }
      }
    }
  }

  if (internal.extensions) {
    for (const extension of internal.extensions) {
      const [schema] = getSchemaAndTableFromName(extension.name);
      if (schema) codeItems.schemas.add(schema);
    }
  }

  if (internal.domains) {
    for (const key in internal.domains) {
      const [schemaName = currentSchema, name] = getSchemaAndTableFromName(key);
      const column = internal.domains[key](columnTypes);

      domains.set(key, {
        schemaName,
        name,
        column,
      });
    }
  }

  for (const domain of domains.values()) {
    codeItems.schemas.add(domain.schemaName);
    codeItems.domains.push(domain);
  }

  return codeItems;
};

const processEnumColumn = (
  column: QueryColumn,
  currentSchema: string,
  codeItems: CodeItems,
) => {
  const { enumName, options } = column as unknown as {
    enumName: string;
    options: [string, ...string[]];
  };

  const [schema, name] = getSchemaAndTableFromName(enumName);
  const enumSchema = schema ?? currentSchema;

  codeItems.enums.set(`${enumSchema}.${name}`, {
    schema: enumSchema,
    name,
    values: options,
  });
  if (schema) codeItems.schemas.add(schema);
};

const processHasAndBelongsToManyColumn = (
  column: QueryColumn & { joinTable: unknown },
  habtmTables: Map<string, CodeTable>,
  codeItems: CodeItems,
) => {
  const q = (column as { joinTable: CodeTable }).joinTable;
  const prev = habtmTables.get(q.table);
  if (prev) {
    for (const key in q.shape) {
      if (q.shape[key].dataType !== prev.shape[key]?.dataType) {
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
      name: column.data.name ?? key,
      identity: undefined,
      primaryKey: undefined,
      default: undefined,
    };
    shape[toCamelCase(key)] = column;
  }
  joinTable.shape = shape;
  joinTable.internal = {
    ...joinTable.internal,
    tableData: {
      ...joinTable.internal.tableData,
      primaryKey: {
        columns: Object.keys(shape),
      },
    },
    noPrimaryKey: false,
  };

  codeItems.tables.push(joinTable);

  return;
};

const closeAdapters = (adapters: Adapter[]) => {
  return Promise.all(adapters.map((x) => x.close()));
};
