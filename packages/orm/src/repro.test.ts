import { createBaseTable, orchidORM, testTransaction } from './';

const BaseTable = createBaseTable({
  snakeCase: true,
});

class UserTable extends BaseTable {
  override readonly table = '_user';

  override columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.varchar(),
  }));

  relations = {
    followers: this.hasAndBelongsToMany(() => UserTable, {
      columns: ['id'],
      references: ['followeeId'],
      through: {
        table: 'user_following',
        columns: ['followerId'],
        references: ['id'],
      },
    }),
    following: this.hasAndBelongsToMany(() => UserTable, {
      columns: ['id'],
      references: ['followerId'],
      through: {
        table: 'user_following',
        columns: ['followeeId'],
        references: ['id'],
      },
    }),
  };
}

class UserFollowingTable extends BaseTable {
  override readonly table = 'user_following';

  override columns = this.setColumns(
    (t) => ({
      /** Who follows */
      followerId: t.integer().foreignKey('user', 'id'),
      /** Who's being followed */
      followeeId: t.integer().foreignKey('user', 'id'),
    }),
    (t) => [t.primaryKey(['followerId', 'followeeId'])],
  );
}

const db = orchidORM(
  { databaseURL: process.env.PG_URL, log: true },
  {
    user: UserTable,
    userFollowing: UserFollowingTable,
  },
);

test('test', async () => {
  await testTransaction.start(db);

  await db.$query`
    create table "_user"
    (
      id   serial primary key,
      name varchar not null
    );
    create table user_following
    (
      follower_id integer not null references "_user" (id),
      followee_id integer not null references "_user" (id),
      primary key (follower_id, followee_id)
    );
  `;

  await db.user.createMany([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ]);

  await db.userFollowing.createMany([
    { followerId: 1, followeeId: 3 }, // Alice follows Charlie
    { followerId: 2, followeeId: 3 }, // Bob follows Charlie
    { followerId: 3, followeeId: 1 }, // Charlie follows Alice
  ]);

  const charlieFollowers = await db.user
    .find(3)
    .followers.select('id', 'name', {
      followers: (q) => q.followers,
      isFollowedBack: (q) => q.followers.find(3).exists(),
    });

  console.dir(charlieFollowers, { depth: null });
  // [
  //   { id: 1, name: 'Alice', followers: [], isFollowedBack: false }, <--- should list Alice as followed back by Charlie
  //   { id: 2, name: 'Bob', followers: [], isFollowedBack: false }
  // ]

  await testTransaction.close(db);
});
