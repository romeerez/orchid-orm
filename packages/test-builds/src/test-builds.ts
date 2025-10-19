import { createBaseTable } from 'orchid-orm';
import { orchidORM as orchidOrmPostgresJs } from 'orchid-orm/postgres-js';
import { orchidORM as orchidOrmNodePostgres } from 'orchid-orm/node-postgres';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';
import { z } from 'zod/v4';
import { any } from 'valibot';
import { rakeDb as rakeDbPostgresJs } from 'orchid-orm/migrations/postgres-js';
import { rakeDb as rakeDbNodePostgres } from 'orchid-orm/migrations/node-postgres';
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

/** rake-db **/

export const changePostgresJs = rakeDbPostgresJs(
  {},
  {
    baseTable: BaseTableZod,
    dbPath: './db',
    migrationsPath: './migrations',
    import: (path) => import(path),
  },
);

export const changeNodePostgres = rakeDbNodePostgres(
  {},
  {
    baseTable: BaseTableZod,
    dbPath: './db',
    migrationsPath: './migrations',
    import: (path) => import(path),
  },
);

/** test-factory **/

export const factory = ormFactory(dbZodPostgresJs);
export const factoryForTable = tableFactory(dbZodPostgresJs.table);
