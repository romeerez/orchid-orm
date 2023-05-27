import { createBaseTable, TableType } from '../table';
import { tableToZod } from 'orchid-orm-schema-to-zod';
import { now, testAdapter, testColumnTypes } from 'test-utils';
import { orchidORM } from '../orm';
import { Query, testTransaction } from 'pqb';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
});

export type User = TableType<UserTable>;
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    Name: t.name('name').text(),
    Password: t.name('password').text(),
    Picture: t.name('picture').text().nullable(),
    Data: t
      .name('data')
      .json((j) =>
        j.object({
          name: j.string(),
          tags: j.string().array(),
        }),
      )
      .nullable(),
    Age: t.name('age').integer().nullable(),
    Active: t.name('active').boolean().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      primaryKey: 'Id',
      foreignKey: 'UserId',
    }),

    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'Id',
      foreignKey: 'AuthorId',
    }),

    chats: this.hasAndBelongsToMany(() => ChatTable, {
      primaryKey: 'Id',
      foreignKey: 'userId',
      associationPrimaryKey: 'IdOfChat',
      associationForeignKey: 'chatId',
      joinTable: 'chatUser',
    }),
  };
}
export const UserSchema = tableToZod(UserTable);

export type Profile = TableType<ProfileTable>;
export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    UserId: t
      .name('userId')
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'Id'),
    Bio: t.name('bio').text().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      required: true,
      primaryKey: 'Id',
      foreignKey: 'UserId',
    }),

    chats: this.hasMany(() => ChatTable, {
      through: 'user',
      source: 'chats',
    }),
  };
}
export const ProfileSchema = tableToZod(ProfileTable);

export type Chat = TableType<ChatTable>;
export class ChatTable extends BaseTable {
  readonly table = 'chat';
  columns = this.setColumns((t) => ({
    // a different id name to better test has and belongs to many
    IdOfChat: t.name('idOfChat').identity().primaryKey(),
    Title: t.name('title').text(),
    ...t.timestamps(),
  }));

  relations = {
    users: this.hasAndBelongsToMany(() => UserTable, {
      primaryKey: 'IdOfChat',
      foreignKey: 'chatId',
      associationPrimaryKey: 'Id',
      associationForeignKey: 'userId',
      joinTable: 'chatUser',
    }),

    profiles: this.hasMany(() => ProfileTable, {
      through: 'users',
      source: 'profile',
    }),

    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'IdOfChat',
      foreignKey: 'ChatId',
    }),
  };
}
export const ChatSchema = tableToZod(ChatTable);

export type Message = TableType<MessageTable>;
export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    ChatId: t
      .name('chatId')
      .integer()
      .foreignKey(() => ChatTable, 'IdOfChat'),
    AuthorId: t
      .name('authorId')
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'Id'),
    Text: t.name('text').text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'Id',
      foreignKey: 'AuthorId',
    }),

    chat: this.belongsTo(() => ChatTable, {
      primaryKey: 'IdOfChat',
      foreignKey: 'ChatId',
    }),

    profile: this.hasOne(() => ProfileTable, {
      required: true,
      through: 'user',
      source: 'profile',
    }),
  };
}
export const MessageSchema = tableToZod(MessageTable);

export type Post = TableType<PostTable>;
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    UserId: t
      .name('userId')
      .integer()
      .foreignKey(() => UserTable, 'Id'),
    Title: t.name('title').text(),
    ...t.timestamps(),
  }));

  relations = {
    postTags: this.hasMany(() => PostTagTable, {
      primaryKey: 'Id',
      foreignKey: 'PostId',
    }),
  };
}
export const PostSchema = tableToZod(PostTable);

export type PostTag = TableType<PostTagTable>;
export class PostTagTable extends BaseTable {
  readonly table = 'postTag';
  columns = this.setColumns((t) => ({
    PostId: t
      .name('postId')
      .integer()
      .foreignKey(() => PostTable, 'Id'),
    Tag: t
      .name('tag')
      .text()
      .foreignKey(() => TagTable, 'Tag'),
    ...t.primaryKey(['postId', 'tag']),
  }));

  relations = {
    tag: this.belongsTo(() => TagTable, {
      primaryKey: 'Tag',
      foreignKey: 'Tag',
    }),
  };
}
export const PostTagSchema = tableToZod(PostTagTable);

export type Tag = TableType<TagTable>;
export class TagTable extends BaseTable {
  readonly table = 'tag';
  columns = this.setColumns((t) => ({
    Tag: t.name('tag').text().primaryKey(),
  }));
}

export class ActiveUserWithProfile extends BaseTable {
  readonly table = 'activeUserWithProfile';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    bio: t.text().nullable(),
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
}

export const db = orchidORM(
  {
    adapter: testAdapter,
    log: false,
  },
  {
    user: UserTable,
    profile: ProfileTable,
    chat: ChatTable,
    message: MessageTable,
    post: PostTable,
    postTag: PostTagTable,
    tag: TagTable,
    activeUserWithProfile: ActiveUserWithProfile,
  },
);

export const userSelectAll = db.user.internal.columnsForSelectAll!.join(', ');

export const profileSelectAll =
  db.profile.internal.columnsForSelectAll!.join(', ');

export const messageSelectAll =
  db.message.internal.columnsForSelectAll!.join(', ');

export const chatSelectAll = db.chat.internal.columnsForSelectAll!.join(', ');

export const userData = {
  Name: 'name',
  Password: 'password',
  updatedAt: now,
  createdAt: now,
};

export const profileData = {
  Bio: 'bio',
  updatedAt: now,
  createdAt: now,
};

export const chatData = {
  Title: 'chat',
  updatedAt: now,
  createdAt: now,
};

export const messageData = {
  Text: 'text',
  updatedAt: now,
  createdAt: now,
};

export const useRelationCallback = (rel: { query: Query }) => {
  const beforeCreate = jest.fn();
  const afterCreate = jest.fn();
  const beforeUpdate = jest.fn();
  const afterUpdate = jest.fn();
  const beforeDelete = jest.fn();
  const afterDelete = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = rel.query.query as any;

  beforeAll(() => {
    q.beforeCreate = [beforeCreate];
    q.afterCreate = [afterCreate];
    q.beforeUpdate = [beforeUpdate];
    q.afterUpdate = [afterUpdate];
    q.beforeDelete = [beforeDelete];
    q.afterDelete = [afterDelete];
  });

  afterAll(() => {
    delete q.beforeCreate;
    delete q.afterCreate;
    delete q.beforeUpdate;
    delete q.afterUpdate;
    delete q.beforeDelete;
    delete q.afterDelete;
  });

  return {
    beforeCreate,
    afterCreate,
    beforeUpdate,
    afterUpdate,
    beforeDelete,
    afterDelete,
    resetMocks() {
      beforeCreate.mockReset();
      afterCreate.mockReset();
      beforeUpdate.mockReset();
      afterUpdate.mockReset();
      beforeDelete.mockReset();
      afterDelete.mockReset();
    },
  };
};

export const useTestORM = () => {
  beforeAll(async () => {
    await testTransaction.start(db);
  });

  beforeEach(async () => {
    await testTransaction.start(db);
  });

  afterEach(async () => {
    await testTransaction.rollback(db);
  });

  afterAll(async () => {
    await testTransaction.close(db);
  });
};
