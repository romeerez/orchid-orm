import { Adapter, AdapterOptions, QueryWithTable } from 'pqb';
import {
  AnyRakeDbConfig,
  makeFileVersion,
  RakeDbAst,
  writeMigrationFile,
} from 'rake-db';
import { introspectDbSchema } from './dbStructure';
import { astToMigration } from './astToMigration';
import { colors } from '../colors';
import { promptSelect } from '../prompt';

interface Table extends QueryWithTable {
  schema?: string;
}

export const generate = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.db || !config.baseTable) throw invalidConfig(config);

  const adapters = getAdapters(options);
  const currentSchema = adapters[0].schema ?? 'public';
  const dbStructure = await migrateAndPullStructures(adapters);

  const schemas = new Set<string>();
  const tables: Table[] = [];

  const { baseTable } = config;
  const exported = await config.db();
  for (const key in exported) {
    const table = exported[key as keyof typeof exported];
    if (!(table instanceof baseTable)) continue;

    if (!table.table) {
      throw new Error(
        `Table ${table.constructor.name} is missing table property`,
      );
    }

    if (table.q.schema) schemas.add(table.q.schema);

    tables.push(table as Table);
  }

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

  for (const table of tables) {
    const stored = dbStructure.tables.find((t) => t.name === table.table);
    if (!stored) continue;

    if (table.schema !== stored.schemaName) {
      ast.push({
        type: 'renameTable',
        fromSchema: stored.schemaName,
        from: table.table,
        toSchema: table.schema ?? currentSchema,
        to: table.table,
      });
    }
  }

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
