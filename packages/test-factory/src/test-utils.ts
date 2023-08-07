import { createBaseTable, orchidORM, Selectable } from 'orchid-orm';
import { testAdapter } from 'test-utils';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
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
      .json((j) =>
        j.object({
          name: j.string(),
          tags: j.string().array(),
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
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}

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
      primaryKey: 'id',
      foreignKey: 'userId',
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
