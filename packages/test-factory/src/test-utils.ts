import { createBaseTable, orchidORM, Selectable } from 'orchid-orm';
import { testAdapter } from 'test-utils';
import { zodSchemaConfig } from 'schema-to-zod';
import { z } from 'zod/v4';

export const BaseTable = createBaseTable({
  snakeCase: true,
  schemaConfig: zodSchemaConfig,
  columnTypes: (t) => ({
    ...t,
    timestamp: () => t.timestamp().asNumber(),
  }),
});

export type User = Selectable<UserTable>;
class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t
      .json(
        z.object({
          name: z.string(),
          tags: z.string().array(),
        }),
      )
      .nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['id'],
      references: ['userId'],
    }),
  };
}

export type Profile = Selectable<ProfileTable>;
export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'id'),
    bio: t.text().min(100).max(100000),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      required: true,
      columns: ['userId'],
      references: ['id'],
    }),
  };
}

export const db = orchidORM(
  {
    adapter: testAdapter,
    log: false,
  },
  {
    user: UserTable,
    profile: ProfileTable,
  },
);
