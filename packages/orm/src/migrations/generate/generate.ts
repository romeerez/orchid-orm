import {
  Adapter,
  PickQueryShape,
  toCamelCase,
  ArrayColumn,
  ColumnsShape,
  Column,
  DomainColumn,
  PickQueryInternal,
  QueryInternal,
  GeneratorIgnore,
  UnknownColumn,
  getQuerySchema,
  emptyObject,
  Grant,
  toArray,
} from 'pqb/internal';
import { Query } from 'pqb';
import {
  concatSchemaAndName,
  getDbVersion,
  getSchemaAndTableFromName,
  introspectDbSchema,
  IntrospectedStructure,
  makeFileVersion,
  makeStructureToAstCtx,
  migrate,
  migrateAndClose,
  RakeDbAst,
  RakeDbConfig,
  writeMigrationFile,
} from 'rake-db';
import { EnumItem } from './generators/enums.generator';
import { CodeDomain } from './generators/domains.generator';
import { composeMigration, ComposeMigrationParams } from './compose-migration';
import { verifyMigration } from './verify-migration';
import { report } from './report-generated-migration';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface CodeTable extends PickQueryShape, PickQueryInternal {
  table: string;
  q: CodeTableQueryData;
}

export interface CodeTableQueryData {
  schema?: string;
}

export interface CodeView extends PickQueryInternal {
  name: string;
  shape: ColumnsShape;
  q: CodeTableQueryData;
  materialized?: boolean;
  viewData: NonNullable<QueryInternal['viewData']>;
}

export interface CodeItems {
  schemas: Set<string>;
  enums: Map<string, EnumItem>;
  tables: CodeTable[];
  views: CodeView[];
  domains: CodeDomain[];
}

interface AfterPull {
  adapter: Adapter;
  version: string;
}

export interface DbInstance {
  $qb: Query;
  $views?: Record<string, Query>;
}

export class AbortSignal extends Error {}

export const generate = async (
  adapters: Adapter[],
  config: RakeDbConfig,
  args: string[],
  afterPull?: AfterPull,
): Promise<void> => {
  let { dbPath } = config;
  if (!dbPath || !config.baseTable) throw invalidConfig(config);
  if (!adapters.length) throw new Error(`Database options must not be empty`);

  if (!dbPath.endsWith('.ts')) dbPath += '.ts';

  let migrationName = args[0] ?? 'generated';
  let up: boolean;
  if (migrationName === 'up') {
    up = true;
    migrationName = 'generated';
  } else {
    up = args[1] === 'up';
  }

  if (afterPull) {
    adapters = [afterPull.adapter];
  }

  const db = await getDbFromConfig(config, dbPath);
  const { columnTypes, internal } = db.$qb;
  const loadDefaultPrivileges =
    internal.roles?.some((role) => role.defaultPrivileges !== undefined) ??
    false;

  const structureParams = {
    loadDefaultPrivileges,
    loadGrants: !!internal.grants || hasCodeItemsWithGrants(db),
    loadViews: hasCodeViews(db),
  };

  const rolesDbStructureParam = internal.roles
    ? internal.managedRolesSql
      ? { whereSql: internal.managedRolesSql }
      : emptyObject
    : undefined;

  const { dbStructure } = await migrateAndPullStructures(
    adapters,
    config,
    db,
    rolesDbStructureParam,
    structureParams,
    afterPull,
  );

  const [adapter] = adapters;
  const adapterSchema = adapter.getSchema();
  const currentSchema =
    (typeof adapterSchema === 'function' ? adapterSchema() : adapterSchema) ??
    'public';

  const codeItems = await getActualItems(
    db,
    currentSchema,
    internal,
    columnTypes,
  );
  const generatorIgnore = getGeneratorIgnoreWithDefinitionIgnoredTableLikes(
    internal.generatorIgnore,
    codeItems.tables,
    codeItems.views,
  );
  const effectiveGrants = getEffectiveGrants(internal.grants, codeItems);

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);

  const generateMigrationParams: ComposeMigrationParams = {
    structureToAstCtx,
    codeItems,
    currentSchema,
    internal: {
      ...internal,
      generatorIgnore,
      grants: effectiveGrants,
    },
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
      rolesDbStructureParam,
      structureParams,
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
    for (const adapter of adapters) {
      await migrateAndClose(adapter, config);
    }
  } else if (!afterPull) {
    await closeAdapters(adapters);
  }
};

const invalidConfig = (config: RakeDbConfig) =>
  new Error(
    `\`${
      config.dbPath ? 'baseTable' : 'dbPath'
    }\` setting must be set in the migrations config for the generator to work`,
  );

const getDbFromConfig = async (
  config: RakeDbConfig,
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
  adapters: Adapter[],
  config: RakeDbConfig,
  db: DbInstance,
  roles?: { whereSql?: string },
  structureParams?: {
    loadDefaultPrivileges?: boolean;
    loadGrants?: boolean;
    loadViews?: boolean;
  },
  afterPull?: AfterPull,
): Promise<{
  dbStructure: IntrospectedStructure;
}> => {
  if (afterPull) {
    const version = await getDbVersion(adapters[0]);

    return {
      dbStructure: {
        version,
        schemas: [],
        tables: [],
        views: [],
        materializedViews: [],
        indexes: [],
        excludes: [],
        constraints: [],
        triggers: [],
        extensions: [],
        enums: [],
        domains: [],
        collations: [],
      },
    };
  }

  for (const adapter of adapters) {
    await migrate(adapter, config);
  }

  const dbStructures = await Promise.all(
    adapters.map((adapter) =>
      introspectDbSchema(adapter, {
        rls: hasCodeTablesWithRls(db),
        roles,
        loadDefaultPrivileges: structureParams?.loadDefaultPrivileges,
        loadGrants: structureParams?.loadGrants,
        loadViews: structureParams?.loadViews,
      }),
    ),
  );

  const dbStructure = dbStructures[0];
  for (let i = 1; i < dbStructures.length; i++) {
    compareDbStructures(dbStructure, dbStructures[i], i);
  }

  return { dbStructure };
};

const hasCodeTablesWithRls = (db: DbInstance): boolean => {
  for (const key in db) {
    if (key[0] === '$') continue;

    const table = db[key as keyof typeof db] as Query;
    if (table.internal.tableRls) return true;
  }

  return false;
};

const hasCodeViews = (db: DbInstance): boolean => {
  return !!Object.keys(db.$views ?? {}).length;
};

const hasCodeItemsWithGrants = (db: DbInstance): boolean => {
  for (const key in db) {
    if (key[0] === '$') continue;

    const table = db[key as keyof typeof db] as Query;
    if (table.internal.tableGrants?.length) return true;
  }

  const views = db.$views;
  if (!views) return false;

  for (const key in views) {
    const view = views[key];
    if (view.internal.tableGrants?.length) return true;
  }

  return false;
};

const getEffectiveGrants = (
  grants: QueryInternal['grants'],
  codeItems: CodeItems,
): QueryInternal['grants'] => {
  const effectiveGrants = grants ? [...grants] : [];

  for (const table of codeItems.tables) {
    const tableGrants = table.internal.tableGrants;
    if (!tableGrants?.length) continue;

    const tableTarget = table.q.schema
      ? `${table.q.schema}.${table.table}`
      : table.table;

    for (const grant of tableGrants) {
      const internalGrant: Grant.InternalPrivilege = {
        ...grant,
        to: toArray(grant.to),
        tables: [tableTarget],
      };

      effectiveGrants.push(internalGrant);
    }
  }

  for (const view of codeItems.views) {
    const viewGrants = view.internal.tableGrants;
    if (!viewGrants?.length) continue;

    const viewTarget = view.q.schema
      ? `${view.q.schema}.${view.name}`
      : view.name;

    for (const grant of viewGrants) {
      const internalGrant: Grant.InternalPrivilege = {
        ...grant,
        to: toArray(grant.to),
        tables: [viewTarget],
      };

      effectiveGrants.push(internalGrant);
    }
  }

  return effectiveGrants.length ? effectiveGrants : undefined;
};

const getGeneratorIgnoreWithDefinitionIgnoredTableLikes = (
  generatorIgnore: GeneratorIgnore | undefined,
  tables: CodeTable[],
  views: CodeView[],
): GeneratorIgnore | undefined => {
  const ignoredTables = new Set(generatorIgnore?.tables);
  const ignoredViews = new Set(generatorIgnore?.views);
  let hasDefinitionIgnoredTableLikes = false;

  for (const table of tables) {
    if (!table.internal.generatorIgnored) continue;

    hasDefinitionIgnoredTableLikes = true;
    ignoredTables.add(
      table.q.schema ? `${table.q.schema}.${table.table}` : table.table,
    );
  }

  for (const view of views) {
    if (!view.internal.generatorIgnored) continue;

    hasDefinitionIgnoredTableLikes = true;
    ignoredViews.add(
      view.q.schema ? `${view.q.schema}.${view.name}` : view.name,
    );
  }

  return hasDefinitionIgnoredTableLikes
    ? {
        ...generatorIgnore,
        tables: [...ignoredTables],
        views: [...ignoredViews],
      }
    : generatorIgnore;
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
    views: [],
    domains: [],
  };

  codeItems.schemas.add(currentSchema);

  const domains = new Map<string, CodeDomain>();

  for (const key in db) {
    if (key[0] === '$') continue;

    const table = db[key as keyof typeof db] as Query;

    if (!table.table) {
      throw new Error(`Table ${key} is missing table property`);
    }

    const schema = getQuerySchema(table);
    const tableName = getQueryNameInDb(table);
    const name = concatSchemaAndName({ schema, name: tableName });
    if (tableNames.has(name)) {
      throw new Error(`Table ${name} is defined more than once`);
    }

    tableNames.add(name);

    if (schema) codeItems.schemas.add(schema);

    codeItems.tables.push({
      table: tableName,
      shape: table.shape,
      internal: {
        ...table.internal,
        rls: internal.rls,
      },
      q: {
        schema: getQuerySchema(table),
      },
    });

    if (!table.internal.generatorIgnored) {
      for (const key in table.relations) {
        const column = table.shape[key];
        // column won't be set for has and belongs to many
        if (column && 'joinTable' in column) {
          processHasAndBelongsToManyColumn(column, habtmTables, codeItems);
        }
      }
    }

    processCodeItemShape(
      table.shape as ColumnsShape,
      currentSchema,
      codeItems,
      domains,
    );
  }

  const views = db.$views;
  if (views) {
    for (const key in views) {
      const view = views[key];
      const schema = getQuerySchema(view);
      const viewName = getQueryNameInDb(view);
      if (schema) codeItems.schemas.add(schema);

      codeItems.views.push({
        name: viewName,
        shape: view.shape as ColumnsShape,
        internal: view.internal,
        q: {
          schema,
        },
        materialized: view.internal.materialized,
        viewData: view.internal.viewData ?? {},
      });

      processCodeItemShape(
        view.shape as ColumnsShape,
        currentSchema,
        codeItems,
        domains,
      );
    }
  }

  if (internal.extensions) {
    for (const extension of internal.extensions) {
      const [schema] = getSchemaAndTableFromName(currentSchema, extension.name);
      if (schema) codeItems.schemas.add(schema);
    }
  }

  if (internal.domains) {
    for (const key in internal.domains) {
      const [schemaName = currentSchema, name] = getSchemaAndTableFromName(
        currentSchema,
        key,
      );
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

  // Add schemas from role default privileges to prevent them from being dropped
  if (internal.roles) {
    for (const role of internal.roles) {
      if (role.defaultPrivileges) {
        for (const privilege of role.defaultPrivileges) {
          if (privilege.schema) codeItems.schemas.add(privilege.schema);
        }
      }
    }
  }

  if (internal.grants) {
    for (const grant of internal.grants) {
      addGrantSchemas(codeItems.schemas, currentSchema, grant);
    }
  }

  return codeItems;
};

const getQueryNameInDb = (query: Query): string => {
  return query.q.nameInDb || (query.table as string);
};

const processCodeItemShape = (
  shape: ColumnsShape,
  currentSchema: string,
  codeItems: CodeItems,
  domains: Map<string, CodeDomain>,
) => {
  for (const key in shape) {
    const column = shape[key] as Column;
    // remove computed columns from the shape
    if (column.data.computed) {
      delete shape[key];
    } else if (column instanceof DomainColumn) {
      const [schemaName = currentSchema, name] = getSchemaAndTableFromName(
        currentSchema,
        column.dataType,
      );
      domains.set(column.dataType, {
        schemaName,
        name,
        column: (column.data.as ?? UnknownColumn.instance) as Column,
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
};

const addGrantSchemas = (
  schemas: Set<string>,
  currentSchema: string,
  grant: NonNullable<QueryInternal['grants']>[number],
) => {
  for (const schema of [
    ...(grant.schemas ?? []),
    ...(grant.allTablesIn ?? []),
    ...(grant.allSequencesIn ?? []),
    ...(grant.allRoutinesIn ?? []),
  ]) {
    schemas.add(schema);
  }

  for (const target of [
    ...(grant.tables ?? []),
    ...(grant.sequences ?? []),
    ...(grant.routines ?? []),
    ...(grant.types ?? []),
    ...(grant.domains ?? []),
  ]) {
    const [schema] = getSchemaAndTableFromName(currentSchema, target);
    if (schema) schemas.add(schema);
  }
};

const processEnumColumn = (
  column: Column.Pick.QueryColumn,
  currentSchema: string,
  codeItems: CodeItems,
) => {
  const { enumName, options } = column as unknown as {
    enumName: string;
    options: [string, ...string[]];
  };

  const [schema, name] = getSchemaAndTableFromName(currentSchema, enumName);
  const enumSchema = schema ?? currentSchema;

  codeItems.enums.set(`${enumSchema}.${name}`, {
    schema: enumSchema,
    name,
    values: options,
  });
  if (schema) codeItems.schemas.add(schema);
};

const processHasAndBelongsToManyColumn = (
  column: Column.Pick.QueryColumn & { joinTable: unknown },
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
