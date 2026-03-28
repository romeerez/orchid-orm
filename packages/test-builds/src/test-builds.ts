import { createBaseTable } from 'orchid-orm';
import { orchidORM as orchidOrmPostgresJs } from 'orchid-orm/postgres-js';
import { orchidORM as orchidOrmNodePostgres } from 'orchid-orm/node-postgres';
import { orchidORM as orchidOrmBunSql } from 'orchid-orm/bun-sql';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';
import { z } from 'zod/v4';
import { any } from 'valibot';
import { rakeDb as rakeDbPostgresJs } from 'orchid-orm/migrations/postgres-js';
import { rakeDb as rakeDbNodePostgres } from 'orchid-orm/migrations/node-postgres';
import { rakeDb as rakeDbBunSql } from 'orchid-orm/migrations/bun-sql';
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

export const dbValibotBunSql = orchidOrmBunSql(
  {},
  {
    table: TableValibot,
  },
);

/** rake-db **/

const rakeDbConfig = {
  baseTable: BaseTableZod,
  dbPath: './db',
  migrationsPath: './migrations',
  import: (path: string) => import(path),
};

export const changePostgresJs: unknown = rakeDbPostgresJs(rakeDbConfig);

export const changeNodePostgres: unknown = rakeDbNodePostgres(rakeDbConfig);

export const changeBunSql: unknown = rakeDbBunSql(rakeDbConfig);

export const runChangePostgresJs = rakeDbPostgresJs.run(
  {} as never,
  rakeDbConfig,
);

export const runChangeNodePostgres = rakeDbNodePostgres.run(
  {} as never,
  rakeDbConfig,
);

export const runChangeBunSql = rakeDbBunSql.run({} as never, rakeDbConfig);

/** test-factory **/

export const factory = ormFactory(dbZodPostgresJs);
export const factoryForTable = tableFactory(dbZodPostgresJs.table);
