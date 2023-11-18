import { createBaseTable, Selectable } from '../baseTable';
import { now, testAdapter, testColumnTypes } from 'test-utils';
import { orchidORM } from '../orm';
import { Query, testTransaction } from 'pqb';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
});

export type User = Selectable<UserTable>;
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    Name: t.name('name').text(),
    UserKey: t.name('userKey').text(),
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
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'ProfileKey'],
    }),

    messages: this.hasMany(() => MessageTable, {
      columns: ['Id', 'UserKey'],
      references: ['AuthorId', 'MessageKey'],
    }),

    chats: this.hasAndBelongsToMany(() => ChatTable, {
      columns: ['Id', 'UserKey'],
      references: ['userId', 'userKey'],
      through: {
        table: 'chatUser',
        columns: ['chatId', 'chatKey'],
        references: ['IdOfChat', 'ChatKey'],
      },
    }),
  };
}

export type Profile = Selectable<ProfileTable>;
export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    ProfileKey: t.name('profileKey').text(),
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
      columns: ['UserId', 'ProfileKey'],
      references: ['Id', 'UserKey'],
    }),

    chats: this.hasMany(() => ChatTable, {
      through: 'user',
      source: 'chats',
    }),

    messages: this.hasMany(() => MessageTable, {
      through: 'user',
      source: 'messages',
    }),
  };
}

export type Chat = Selectable<ChatTable>;
export class ChatTable extends BaseTable {
  readonly table = 'chat';
  columns = this.setColumns((t) => ({
    // a different id name to better test has and belongs to many
    IdOfChat: t.name('idOfChat').identity().primaryKey(),
    ChatKey: t.name('chatKey').text(),
    Title: t.name('title').text(),
    ...t.timestamps(),
  }));

  relations = {
    users: this.hasAndBelongsToMany(() => UserTable, {
      columns: ['IdOfChat', 'ChatKey'],
      references: ['chatId', 'chatKey'],
      through: {
        table: 'chatUser',
        columns: ['userId', 'userKey'],
        references: ['Id', 'UserKey'],
      },
    }),

    profiles: this.hasMany(() => ProfileTable, {
      through: 'users',
      source: 'profile',
    }),

    messages: this.hasMany(() => MessageTable, {
      columns: ['IdOfChat', 'ChatKey'],
      references: ['ChatId', 'MessageKey'],
    }),
  };
}

export type Message = Selectable<MessageTable>;
export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    MessageKey: t.name('messageKey').text(),
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
      columns: ['AuthorId', 'MessageKey'],
      references: ['Id', 'UserKey'],
    }),

    chat: this.belongsTo(() => ChatTable, {
      columns: ['ChatId', 'MessageKey'],
      references: ['IdOfChat', 'ChatKey'],
    }),

    profile: this.hasOne(() => ProfileTable, {
      required: true,
      through: 'user',
      source: 'profile',
    }),
  };
}

export type Post = Selectable<PostTable>;
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    UserId: t
      .name('userId')
      .integer()
      .foreignKey(() => UserTable, 'Id'),
    Body: t.name('body').text(),
    Title: t.name('title').text(),
    ...t.timestamps(),
  }));

  relations = {
    postTags: this.hasMany(() => PostTagTable, {
      columns: ['Id'],
      references: ['PostId'],
    }),
    tags: this.hasMany(() => TagTable, {
      through: 'postTags',
      source: 'tag',
    }),
  };
}

export type PostTag = Selectable<PostTagTable>;
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
      columns: ['Tag'],
      references: ['Tag'],
    }),
  };
}

export type Tag = Selectable<TagTable>;
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
  UserKey: 'key',
  Password: 'password',
  updatedAt: now,
  createdAt: now,
};

export const profileData = {
  Bio: 'bio',
  ProfileKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const chatData = {
  Title: 'title',
  ChatKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const messageData = {
  Text: 'text',
  MessageKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const useRelationCallback = <T extends Query>(
  rel: { relationConfig: { query: T } },
  select: (keyof T['shape'])[],
) => {
  const beforeCreate = jest.fn();
  const afterCreate = jest.fn();
  const beforeUpdate = jest.fn();
  const afterUpdate = jest.fn();
  const beforeDelete = jest.fn();
  const afterDelete = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = rel.relationConfig.query.q as any;

  beforeAll(() => {
    q.beforeCreate = [beforeCreate];
    q.afterCreate = [afterCreate];
    q.afterCreateSelect = select;
    q.beforeUpdate = [beforeUpdate];
    q.afterUpdate = [afterUpdate];
    q.afterUpdateSelect = select;
    q.beforeDelete = [beforeDelete];
    q.afterDelete = [afterDelete];
    q.afterDeleteSelect = select;
  });

  afterAll(() => {
    delete q.beforeCreate;
    delete q.afterCreate;
    delete q.afterCreateSelect;
    delete q.beforeUpdate;
    delete q.afterUpdate;
    delete q.afterUpdateSelect;
    delete q.beforeDelete;
    delete q.afterDelete;
    delete q.afterDeleteSelect;
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
