import {
  Adapter,
  AdapterClass,
  createBaseTable,
  orchidORMWithAdapter,
} from 'orchid-orm';
import {
  Adapter as PostgresJsAdapter,
  PostgresJsAdapterOptions,
  orchidORM as orchidOrmPostgresJs,
} from 'orchid-orm/postgres-js';
import {
  Adapter as NodePostgresAdapter,
  NodePostgresAdapterOptions,
  orchidORM as orchidOrmNodePostgres,
} from 'orchid-orm/node-postgres';
import {
  Adapter as BunAdapter,
  BunAdapterOptions,
  orchidORM as orchidOrmBun,
} from 'orchid-orm/bun';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';
import { z } from 'zod/v4';
import { any } from 'valibot';
import { rakeDb as rakeDbPostgresJs } from 'orchid-orm/migrations/postgres-js';
import { rakeDb as rakeDbNodePostgres } from 'orchid-orm/migrations/node-postgres';
import { rakeDb as rakeDbBun } from 'orchid-orm/migrations/bun';
import { ormFactory, tableFactory } from 'orchid-orm-test-factory';

/** ORM **/

export const BaseTableZod = createBaseTable({
  schemaConfig: zodSchemaConfig,

  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: (precision?: number) => t.timestamp(precision).asDate(),
  }),
});

export const BaseTableValibot = createBaseTable({
  schemaConfig: valibotSchemaConfig,

  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: (precision?: number) => t.timestamp(precision).asDate(),
  }),
});

export class TableZod extends BaseTableZod {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    json: t.json(z.any()),
    ...t.timestamps(),
  }));
}

export class TableValibot extends BaseTableValibot {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    json: t.json(any()),
    ...t.timestamps(),
  }));
}

export const dbZodPostgresJs = orchidOrmPostgresJs(
  {},
  {
    table: TableZod,
  },
);

export const dbZodNodePostgres = orchidOrmNodePostgres(
  {},
  {
    table: TableZod,
  },
);

export const dbZodBun = orchidOrmBun(
  {},
  {
    table: TableZod,
  },
);

export const dbValibotPostgresJs = orchidOrmPostgresJs(
  {},
  {
    table: TableValibot,
  },
);

export const dbValibotNodePostgres = orchidOrmNodePostgres(
  {},
  {
    table: TableValibot,
  },
);

/** ORM with adapter **/

const postgresJsConfig: PostgresJsAdapterOptions = { databaseURL: '' };
const nodePostgresConfig: NodePostgresAdapterOptions = { databaseURL: '' };
const bunConfig: BunAdapterOptions = { databaseURL: '' };

export const postgresJsAdapter: Adapter = new AdapterClass({
  driverAdapter: PostgresJsAdapter,
  config: postgresJsConfig,
});

export const nodePostgresAdapter: Adapter = new AdapterClass({
  driverAdapter: NodePostgresAdapter,
  config: nodePostgresConfig,
});

export const bunAdapter: Adapter = new AdapterClass({
  driverAdapter: BunAdapter,
  config: bunConfig,
});

export const dbWithAdapter = orchidORMWithAdapter(
  { adapter: postgresJsAdapter },
  {
    table: TableZod,
  },
);

export const currentAdapter: Adapter = dbWithAdapter.$getAdapter();

/** rake-db **/

export const changePostgresJs = rakeDbPostgresJs({
  baseTable: BaseTableZod,
  dbPath: './db',
  migrationsPath: './migrations',
  import: (path: string) => import(path),
});

export const changeNodePostgres = rakeDbNodePostgres({
  baseTable: BaseTableZod,
  dbPath: './db',
  migrationsPath: './migrations',
  import: (path: string) => import(path),
});

export const changeBun = rakeDbBun({
  baseTable: BaseTableZod,
  dbPath: './db',
  migrationsPath: './migrations',
  import: (path: string) => import(path),
});

/** test-factory **/

export const factory = ormFactory(dbZodPostgresJs);
export const factoryForTable = tableFactory(dbZodPostgresJs.table);
