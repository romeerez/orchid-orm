import {
  Adapter,
  AdapterOptions,
  ColumnsShape,
  Query,
  QueryInternal,
  QueryWithTable,
} from 'pqb';
import {
  AnyRakeDbConfig,
  makeFileVersion,
  migrate,
  RakeDbAst,
  writeMigrationFile,
} from 'rake-db';
import { introspectDbSchema, IntrospectedStructure } from './dbStructure';
import { astToMigration } from './astToMigration';
import {
  addCode,
  Code,
  codeToString,
  QueryColumn,
  RecordUnknown,
} from 'orchid-core';
import { exhaustive, getSchemaAndTableFromName, pluralize } from '../common';
import { processSchemas } from './generators/schemas.generator';
import { EnumItem, processEnums } from './generators/enums.generator';
import { processTables } from './generators/tables.generator';
import { processExtensions } from './generators/extensions.generator';
import { CodeDomain, processDomains } from './generators/domains.generator';
import { makeDomainsMap, makeStructureToAstCtx } from './structureToAst';
import { colors } from '../colors';
import { getColumnDbType } from './generators/columns.generator';

interface ActualItems {
  schemas: Set<string>;
  enums: Map<string, EnumItem>;
  tables: QueryWithTable[];
  domains: CodeDomain[];
}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.db || !config.baseTable) throw invalidConfig(config);
  if (!options.length) throw new Error(`Database options must not be empty`);

  const { dbStructure, adapters } = await migrateAndPullStructures(
    options,
    config,
  );

  const currentSchema = adapters[0].schema ?? 'public';
  const db = await config.db();
  const { columnTypes, internal } = db.$queryBuilder;

  const { schemas, enums, tables, domains } = await getActualItems(
    db,
    currentSchema,
    internal,
    columnTypes,
  );

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  const ast: RakeDbAst[] = [];
  await processSchemas(ast, schemas, dbStructure);
  processExtensions(ast, dbStructure, currentSchema, internal.extensions);
  await processDomains(
    ast,
    adapters[0],
    structureToAstCtx,
    domainsMap,
    dbStructure,
    currentSchema,
    domains,
  );
  await processEnums(ast, enums, dbStructure, currentSchema);
  await processTables(
    ast,
    structureToAstCtx,
    domainsMap,
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

  const { logger } = config;
  const delayLog: string[] = [];
  await writeMigrationFile(
    {
      ...config,
      logger: logger ? { ...logger, log: (msg) => delayLog.push(msg) } : logger,
    },
    version,
    'pull',
    result,
  );

  report(ast, config, currentSchema);

  if (logger) {
    for (const msg of delayLog) {
      logger.log(`\n${msg}`);
    }
  }
};

const invalidConfig = (config: AnyRakeDbConfig) =>
  new Error(
    `\`${
      config.db ? 'baseTable' : 'db'
    }\` setting must be set in the rake-db config for the generator to work`,
  );

const migrateAndPullStructures = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
): Promise<{ dbStructure: IntrospectedStructure; adapters: Adapter[] }> => {
  const adapters = await migrate({}, options, config, undefined, true);

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
  db: RecordUnknown,
  currentSchema: string,
  internal: QueryInternal,
  columnTypes: unknown,
): Promise<ActualItems> => {
  const tableNames = new Set<string>();
  const habtmTables = new Map<string, QueryWithTable>();

  const actualItems: ActualItems = {
    schemas: new Set(undefined),
    enums: new Map(),
    tables: [],
    domains: [],
  };

  for (const key in db) {
    if (key[0] === '$') continue;

    const table = db[key as keyof typeof db] as Query;

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

  if (internal.domains) {
    for (const key in internal.domains) {
      const [schemaName = currentSchema, name] = getSchemaAndTableFromName(key);
      const column = internal.domains[key](columnTypes);

      actualItems.schemas.add(schemaName);

      actualItems.domains.push({
        schemaName,
        name,
        column,
      });
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

const report = (
  ast: RakeDbAst[],
  config: AnyRakeDbConfig,
  currentSchema: string,
) => {
  if (!config.logger) return;

  const code: Code[] = [];

  let green, red, yellow, pale;
  if (typeof config.log === 'object' && config.log.colors === false) {
    green = red = yellow = pale = (s: string) => s;
  } else {
    ({ green, red, yellow, pale } = colors);
  }

  for (const a of ast) {
    switch (a.type) {
      case 'table': {
        let hasPrimaryKey = !!a.primaryKey;
        const counters = {
          column: 0,
          index: a.indexes?.length ?? 0,
          'foreign key':
            a.constraints?.reduce<number>(
              (sum, c) => (c.references ? sum + 1 : sum),
              0,
            ) ?? 0,
          check:
            a.constraints?.reduce<number>(
              (sum, c) => (c.check ? sum + 1 : sum),
              0,
            ) ?? 0,
        };
        for (const key in a.shape) {
          counters.column++;

          const column = a.shape[key];
          if (column.data.isPrimaryKey) {
            hasPrimaryKey = true;
          }

          if (column.data.indexes) {
            counters.index += column.data.indexes.length;
          }

          if (column.data.foreignKeys) {
            counters['foreign key'] += column.data.foreignKeys.length;
          }

          if (column.data.check) {
            counters.check++;
          }
        }

        const summary: string[] = [];

        for (const key in counters) {
          const value = counters[key as keyof typeof counters];
          if (value || key === 'column') {
            summary.push(
              `${value} ${pluralize(key, value, key === 'index' ? 'es' : 's')}`,
            );
          }
        }

        if (!hasPrimaryKey) {
          summary.push('no primary key');
        }

        code.push(
          `${
            a.action === 'create'
              ? green('+ create table')
              : red('- drop table')
          } ${dbItemName(a, currentSchema)} (${summary.join(', ')})`,
        );
        break;
      }
      case 'changeTable': {
        const inner: Code[] = [];

        for (const key in a.shape) {
          const change = a.shape[key];
          if (change.type === 'add' || change.type === 'drop') {
            const column = change.item;
            const name = column.data.name ?? key;
            const { isPrimaryKey, indexes, foreignKeys, check } = column.data;

            inner.push(
              `${
                change.type === 'add'
                  ? green('+ add column')
                  : red('- drop column')
              } ${name} ${getColumnDbType(column, currentSchema)}${
                column.data.isNullable ? ' nullable' : ''
              }${isPrimaryKey ? ' primary key' : ''}${
                foreignKeys
                  ? ` references ${foreignKeys
                      .map(
                        (fk) =>
                          'table' in fk &&
                          `${fk.table}(${fk.columns.join(', ')})`,
                      )
                      .join(', ')}`
                  : ''
              }${
                indexes?.length
                  ? indexes.length === 1
                    ? ', has index'
                    : `, has ${indexes.length} indexes`
                  : ''
              }${check ? `, checks ${check.toSQL({ values: [] })}` : ''}`,
            );
          } else if (change.type === 'change') {
            const name = change.from.column?.data.name ?? key;
            const changes: Code[] = [];
            inner.push(`${yellow('~ change column')} ${name}:`, changes);
            changes.push(`${yellow('from')}: `);
            for (const code of change.from.column!.toCode('t', true)) {
              addCode(changes, code);
            }
            changes.push(`  ${yellow('to')}: `);
            for (const code of change.to.column!.toCode('t', true)) {
              addCode(changes, code);
            }
          } else if (change.type === 'rename') {
            inner.push(
              `${yellow('~ rename column')} ${key} ${yellow('=>')} ${
                change.name
              }`,
            );
          } else {
            exhaustive(change.type);
          }
        }

        if (a.drop.primaryKey) {
          inner.push(
            `${red(`- drop primary key`)} on (${a.drop.primaryKey.columns.join(
              ', ',
            )})`,
          );
        }

        if (a.drop.indexes) {
          for (const index of a.drop.indexes) {
            inner.push(
              `${red(
                `- drop${index.options.unique ? ' unique' : ''} index`,
              )} on (${index.columns
                .map((c) => ('column' in c ? c.column : c.expression))
                .join(', ')})`,
            );
          }
        }

        if (a.drop.constraints) {
          for (const { references } of a.drop.constraints) {
            if (!references) continue;

            const [schema, name] = getSchemaAndTableFromName(
              references.fnOrTable as string,
            );

            inner.push(
              `${red(`- drop foreign key`)} on (${references.columns.join(
                ', ',
              )}) to ${dbItemName(
                {
                  schema,
                  name,
                },
                currentSchema,
              )}(${references.foreignColumns.join(', ')})`,
            );
          }

          for (const { check } of a.drop.constraints) {
            if (!check) continue;

            inner.push(`${red(`- drop check`)} ${check.toSQL({ values: [] })}`);
          }
        }

        if (a.add.primaryKey) {
          inner.push(
            `${green(`+ add primary key`)} on (${a.add.primaryKey.columns.join(
              ', ',
            )})`,
          );
        }

        if (a.add.indexes) {
          for (const index of a.add.indexes) {
            inner.push(
              `${green(
                `+ add${index.options.unique ? ' unique' : ''} index`,
              )} on (${index.columns
                .map((c) => ('column' in c ? c.column : c.expression))
                .join(', ')})`,
            );
          }
        }

        if (a.add.constraints) {
          for (const { references } of a.add.constraints) {
            if (!references) continue;

            inner.push(
              `${green(`+ add foreign key`)} on (${references.columns.join(
                ', ',
              )}) to ${
                references.fnOrTable as string
              }(${references.foreignColumns.join(', ')})`,
            );
          }

          for (const { check } of a.add.constraints) {
            if (!check) continue;

            inner.push(
              `${green(`+ add check`)} ${check.toSQL({ values: [] })}`,
            );
          }
        }

        code.push(
          `${yellow('~ change table')} ${dbItemName(a, currentSchema)}${
            inner.length ? ':' : ''
          }`,
        );

        if (inner.length) {
          code.push(inner);
        }

        break;
      }
      case 'schema': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create schema')
              : red('- drop schema')
          } ${a.name}`,
        );
        break;
      }
      case 'renameSchema': {
        code.push(
          `${yellow('~ rename schema')} ${a.from} ${yellow('=>')} ${a.to}`,
        );
        break;
      }
      case 'renameType': {
        code.push(
          `${yellow(
            `~ ${
              a.fromSchema !== a.toSchema
                ? a.from !== a.to
                  ? 'change schema and rename'
                  : 'change schema of'
                : 'rename'
            } ${a.kind.toLowerCase()}`,
          )} ${dbItemName(
            {
              schema: a.fromSchema,
              name: a.from,
            },
            currentSchema,
          )} ${yellow('=>')} ${dbItemName(
            {
              schema: a.toSchema,
              name: a.to,
            },
            currentSchema,
          )}`,
        );
        break;
      }
      case 'extension': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create extension')
              : red('- drop extension')
          } ${dbItemName(a, currentSchema)}${
            a.version ? ` ${pale(a.version)}` : ''
          }`,
        );
        break;
      }
      case 'enum': {
        code.push(
          `${
            a.action === 'create' ? green('+ create enum') : red('- drop enum')
          } ${dbItemName(a, currentSchema)}: (${a.values.join(', ')})`,
        );
        break;
      }
      case 'enumValues': {
        code.push(
          `${
            a.action === 'add'
              ? green('+ add values to enum')
              : red('- remove values from enum')
          } ${dbItemName(a, currentSchema)}: ${a.values.join(', ')}`,
        );
        break;
      }
      case 'changeEnumValues': {
        if (a.fromValues) {
          code.push(
            `${red('- remove values from enum')} ${dbItemName(
              a,
              currentSchema,
            )}: ${a.fromValues.join(', ')}`,
          );
        }
        if (a.toValues) {
          code.push(
            `${green('+ add values to enum')} ${dbItemName(
              a,
              currentSchema,
            )}: ${a.toValues.join(', ')}`,
          );
        }
        break;
      }
      case 'domain': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create domain')
              : red('- drop domain')
          } ${dbItemName(a, currentSchema)}`,
        );
        break;
      }
      case 'view':
      case 'collation':
      case 'renameEnumValues':
      case 'constraint':
        break;
      case 'renameTableItem': {
        code.push(
          `${yellow(`~ rename ${a.kind.toLowerCase()}`)} on table ${dbItemName(
            { schema: a.tableSchema, name: a.tableName },
            currentSchema,
          )}: ${a.from} ${yellow('=>')} ${a.to}`,
        );
        break;
      }
      default:
        exhaustive(a);
    }
  }

  const result = codeToString(code, '', '  ');
  config.logger.log(result);
};

const dbItemName = (
  { schema, name }: { schema?: string; name: string },
  currentSchema: string,
) => {
  return schema && schema !== currentSchema ? `${schema}.${name}` : name;
};
