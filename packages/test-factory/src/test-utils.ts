import { createBaseTable, orchidORM } from 'orchid-orm';
import { Adapter } from 'pqb';
import {
  patchPgForTransactions,
  rollbackTransaction,
  startTransaction,
} from 'pg-transactional-tests';

type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

export const assertType = <T, Expected>(
  ..._: AssertEqual<T, Expected> extends true ? [] : ['invalid type']
) => {
  // noop
};

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
    timestamp: () => t.timestamp().asNumber(),
  }),
});

export type User = UserTable['columns']['type'];
class UserTable extends BaseTable {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
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
  table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
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

export const adapter = new Adapter({
  databaseURL: process.env.PG_URL,
});

export const db = orchidORM(
  {
    adapter,
    log: false,
  },
  {
    user: UserTable,
    profile: ProfileTable,
  },
);

export const useTestDatabase = () => {
  beforeAll(patchPgForTransactions);
  beforeEach(startTransaction);
  afterEach(rollbackTransaction);
  afterAll(async () => {
    await adapter.close();
  });
};
