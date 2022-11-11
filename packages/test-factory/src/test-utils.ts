import { createModel, porm } from 'porm';
import { Adapter, columnTypes } from 'pqb';

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

const Model = createModel({
  columnTypes,
});

export type User = UserModel['columns']['type'];
class UserModel extends Model {
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
    profile: this.hasOne(() => ProfileModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}

export class ProfileModel extends Model {
  table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .nullable()
      .foreignKey(() => UserModel, 'id'),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}

const adapter = new Adapter({
  connectionString: process.env.DATABASE_URL,
});

export const db = porm(
  {
    adapter,
    log: false,
  },
  {
    user: UserModel,
    profile: ProfileModel,
  },
);
