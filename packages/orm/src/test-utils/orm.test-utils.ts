import { createBaseTable, DefaultSelect } from '../baseTable';
import { now, testAdapter, testColumnTypes } from 'test-utils';
import { orchidORM } from '../orm';
import { ColumnsShape, Query, testTransaction } from 'pqb';

export const BaseTable = createBaseTable({
  snakeCase: true,
  columnTypes: testColumnTypes,
});

export const { sql } = BaseTable;

export type User = DefaultSelect<UserTable>;
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    Name: t.name('name').text(),
    UserKey: t.name('user_key').text(),
    Password: t.name('password').text().select(false),
    Picture: t.name('picture').text().nullable(),
    Data: t.name('data').json<{ name: string; tags: string[] }>().nullable(),
    Age: t.name('age').decimal().nullable(),
    Active: t.name('active').boolean().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'ProfileKey'],
    }),

    activeProfile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'ProfileKey'],
      on: {
        Active: true,
      },
    }),

    messages: this.hasMany(() => MessageTable, {
      columns: ['Id', 'UserKey'],
      references: ['AuthorId', 'MessageKey'],
    }),

    activeMessages: this.hasMany(() => MessageTable, {
      columns: ['Id', 'UserKey'],
      references: ['AuthorId', 'MessageKey'],
      on: {
        Active: true,
      },
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

    activeChats: this.hasAndBelongsToMany(() => ChatTable, {
      columns: ['Id', 'UserKey'],
      references: ['userId', 'userKey'],
      through: {
        table: 'chatUser',
        columns: ['chatId', 'chatKey'],
        references: ['IdOfChat', 'ChatKey'],
      },
      on: {
        Active: true,
      },
    }),

    posts: this.hasMany(() => PostTable, {
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'Title'],
    }),

    activePosts: this.hasMany(() => PostTable, {
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'Title'],
      on: {
        Active: true,
      },
    }),

    onePost: this.hasOne(() => PostTable, {
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'Title'],
    }),

    activeOnePost: this.hasOne(() => PostTable, {
      columns: ['Id', 'UserKey'],
      references: ['UserId', 'Title'],
      on: {
        Active: true,
      },
    }),

    postTags: this.hasAndBelongsToMany(() => PostTagTable, {
      columns: ['Id', 'UserKey'],
      references: ['userId', 'title'],
      through: {
        table: 'post',
        columns: ['id'],
        references: ['PostId'],
      },
    }),

    activePostTags: this.hasAndBelongsToMany(() => PostTagTable, {
      columns: ['Id', 'UserKey'],
      references: ['userId', 'title'],
      through: {
        table: 'post',
        columns: ['id'],
        references: ['PostId'],
      },
      on: {
        Active: true,
      },
    }),
  };
}

export type Profile = DefaultSelect<ProfileTable>;
export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    ProfileKey: t.name('profile_key').text(),
    UserId: t
      .name('user_id')
      .integer()
      .nullable()
      .unique()
      .foreignKey(() => UserTable, 'Id'),
    Bio: t.name('bio').text().nullable(),
    Active: t.name('active').boolean().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['UserId', 'ProfileKey'],
      references: ['Id', 'UserKey'],
    }),

    activeUser: this.belongsTo(() => UserTable, {
      columns: ['UserId', 'ProfileKey'],
      references: ['Id', 'UserKey'],
      on: {
        Active: true,
      },
    }),

    chats: this.hasMany(() => ChatTable, {
      through: 'user',
      source: 'chats',
    }),

    activeChats: this.hasMany(() => ChatTable, {
      through: 'activeUser',
      source: 'activeChats',
      on: {
        Active: true,
      },
    }),

    messages: this.hasMany(() => MessageTable, {
      through: 'user',
      source: 'messages',
    }),

    posts: this.hasMany(() => PostTable, {
      through: 'user',
      source: 'posts',
    }),

    activePosts: this.hasMany(() => PostTable, {
      through: 'activeUser',
      source: 'activePosts',
      on: {
        Active: true,
      },
    }),

    onePost: this.hasOne(() => PostTable, {
      through: 'user',
      source: 'onePost',
    }),

    activeOnePost: this.hasOne(() => PostTable, {
      through: 'activeUser',
      source: 'activeOnePost',
    }),
  };
}

export type Chat = DefaultSelect<ChatTable>;
export class ChatTable extends BaseTable {
  readonly table = 'chat';
  columns = this.setColumns((t) => ({
    // a different id name to better test has and belongs to many
    IdOfChat: t.name('id_of_chat').identity().primaryKey(),
    ChatKey: t.name('chat_key').text(),
    Title: t.name('title').text(),
    Active: t.name('active').boolean().nullable(),
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

    activeUsers: this.hasAndBelongsToMany(() => UserTable, {
      columns: ['IdOfChat', 'ChatKey'],
      references: ['chatId', 'chatKey'],
      through: {
        table: 'chatUser',
        columns: ['userId', 'userKey'],
        references: ['Id', 'UserKey'],
      },
      on: {
        Active: true,
      },
    }),

    profiles: this.hasMany(() => ProfileTable, {
      through: 'users',
      source: 'profile',
    }),

    activeProfiles: this.hasMany(() => ProfileTable, {
      through: 'activeUsers',
      source: 'activeProfile',
    }),

    messages: this.hasMany(() => MessageTable, {
      columns: ['IdOfChat', 'ChatKey'],
      references: ['ChatId', 'MessageKey'],
    }),

    activeMessages: this.hasMany(() => MessageTable, {
      columns: ['IdOfChat', 'ChatKey'],
      references: ['ChatId', 'MessageKey'],
      on: {
        Active: true,
      },
    }),
  };
}

export type Message = DefaultSelect<MessageTable>;
export class MessageTable extends BaseTable {
  readonly table = 'message';

  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    MessageKey: t.name('message_key').text(),
    ChatId: t
      .name('chat_id')
      .integer()
      .foreignKey(() => ChatTable, 'IdOfChat'),
    AuthorId: t
      .name('author_id')
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'Id'),
    Text: t.name('text').text(),
    Decimal: t.name('decimal').decimal().nullable(),
    Active: t.name('active').boolean().nullable(),
    DeletedAt: t.name('deleted_at').timestamp().nullable(),
    ...t.timestamps(),
  }));

  readonly softDelete = 'DeletedAt';

  relations = {
    sender: this.belongsTo(() => UserTable, {
      columns: ['AuthorId', 'MessageKey'],
      references: ['Id', 'UserKey'],
    }),

    activeSender: this.belongsTo(() => UserTable, {
      columns: ['AuthorId', 'MessageKey'],
      references: ['Id', 'UserKey'],
      on: {
        Active: true,
      },
    }),

    chat: this.belongsTo(() => ChatTable, {
      columns: ['ChatId', 'MessageKey'],
      references: ['IdOfChat', 'ChatKey'],
    }),

    activeChat: this.belongsTo(() => ChatTable, {
      columns: ['ChatId', 'MessageKey'],
      references: ['IdOfChat', 'ChatKey'],
      on: {
        Active: true,
      },
    }),

    profile: this.hasOne(() => ProfileTable, {
      required: true,
      through: 'sender',
      source: 'profile',
    }),

    activeProfile: this.hasOne(() => ProfileTable, {
      required: true,
      through: 'activeSender',
      source: 'activeProfile',
      on: {
        Active: true,
      },
    }),

    profiles: this.hasMany(() => ProfileTable, {
      required: true,
      through: 'sender',
      source: 'profile',
    }),

    activeProfiles: this.hasMany(() => ProfileTable, {
      required: true,
      through: 'activeSender',
      source: 'activeProfile',
    }),
  };
}

export type Post = DefaultSelect<PostTable>;
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    Id: t.name('id').identity().primaryKey(),
    UserId: t
      .name('user_id')
      .integer()
      .foreignKey(() => UserTable, 'Id'),
    Active: t.name('active').boolean().nullable(),
    Body: t.name('body').text(),
    Title: t.name('title').text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['UserId', 'Title'],
      references: ['Id', 'UserKey'],
    }),

    activeUser: this.belongsTo(() => UserTable, {
      columns: ['UserId', 'Title'],
      references: ['Id', 'UserKey'],
      on: {
        Active: true,
      },
    }),

    postTags: this.hasMany(() => PostTagTable, {
      columns: ['Id'],
      references: ['PostId'],
    }),

    activePostTags: this.hasMany(() => PostTagTable, {
      columns: ['Id'],
      references: ['PostId'],
      on: {
        Active: true,
      },
    }),

    onePostTag: this.hasOne(() => PostTagTable, {
      columns: ['Id'],
      references: ['PostId'],
    }),

    activeOnePostTag: this.hasOne(() => PostTagTable, {
      columns: ['Id'],
      references: ['PostId'],
      on: {
        Active: true,
      },
    }),

    tags: this.hasMany(() => TagTable, {
      through: 'postTags',
      source: 'tag',
    }),

    oneTag: this.hasOne(() => TagTable, {
      through: 'onePostTag',
      source: 'tag',
    }),
  };
}

export type PostTag = DefaultSelect<PostTagTable>;
export class PostTagTable extends BaseTable {
  readonly table = 'postTag';
  columns = this.setColumns(
    (t) => ({
      PostId: t
        .name('post_id')
        .integer()
        .foreignKey(() => PostTable, 'Id'),
      Tag: t
        .name('tag')
        .text()
        .foreignKey(() => TagTable, 'Tag'),
      Active: t.name('active').boolean().nullable(),
    }),
    (t) => t.primaryKey(['PostId', 'Tag']),
  );

  relations = {
    post: this.belongsTo(() => PostTable, {
      columns: ['PostId'],
      references: ['Id'],
    }),

    activePost: this.belongsTo(() => PostTable, {
      columns: ['PostId'],
      references: ['Id'],
      on: {
        Active: true,
      },
    }),

    tag: this.belongsTo(() => TagTable, {
      columns: ['Tag'],
      references: ['Tag'],
    }),
  };
}

export type Tag = DefaultSelect<TagTable>;
export class TagTable extends BaseTable {
  readonly table = 'tag';
  columns = this.setColumns((t) => ({
    Tag: t.name('tag').text().primaryKey(),
  }));

  relations = {
    postTags: this.hasMany(() => PostTagTable, {
      columns: ['Tag'],
      references: ['Tag'],
    }),
  };
}

export class ActiveUserWithProfile extends BaseTable {
  readonly table = 'activeUserWithProfile';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    bio: t.text().nullable(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json<{ name: string; tags: string[] }>().nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
}

class CategoryTable extends BaseTable {
  readonly table = 'category';
  columns = this.setColumns((t) => ({
    categoryName: t.text().primaryKey(),
    parentName: t.text().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    category: this.belongsTo(() => CategoryTable, {
      columns: ['parentName'],
      references: ['categoryName'],
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
    chat: ChatTable,
    message: MessageTable,
    post: PostTable,
    postTag: PostTagTable,
    tag: TagTable,
    activeUserWithProfile: ActiveUserWithProfile,
    category: CategoryTable,
  },
);

const tableJsonBuildObject = (table: Query) => {
  const cache: { [key: string]: string } = {};
  return (t: string) =>
    (cache[t] ??= `json_build_object(${table.q
      .selectAllColumns!.map((c) => {
        const [, name] = c.split(' ');
        return `${name.replaceAll('"', "'")}, ${t}.${name}${
          (table.shape as ColumnsShape)[name.slice(1, -1)]?.data.jsonCast
            ? '::text'
            : ''
        }`;
      })
      .join(', ')})`);
};

const tableRowToJSON = (table: Query) => {
  const cache: { [key: string]: string } = {};
  const jsonBuildObject = tableJsonBuildObject(table);
  return (t: string) =>
    (cache[t] ??= `CASE WHEN "${t}".* IS NULL THEN NULL ELSE ${jsonBuildObject(
      `"${t}"`,
    )} END`);
};

export const userSelectAll = db.user.q.selectAllColumns!.join(', ');

export const userRowToJSON = tableRowToJSON(db.user);

export const profileSelectAll = db.profile.q.selectAllColumns!.join(', ');

export const messageSelectAll = db.message.q.selectAllColumns!.join(', ');

export const messageRowToJSON = tableRowToJSON(db.message);

export const messageJSONBuildObject = tableJsonBuildObject(db.message);

export const chatSelectAll = db.chat.q.selectAllColumns!.join(', ');

export const postSelectAll = db.post.q.selectAllColumns!.join(', ');

export const postTagSelectAll = db.postTag.q.selectAllColumns!.join(', ');

export const postTagSelectTableAll = (t: string) =>
  db.postTag.q.selectAllColumns!.map((c) => `"${t}".${c}`).join(', ');

export const categorySelectAll = db.category.q.selectAllColumns!.join(', ');

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

export const postData = {
  Body: 'body',
  Title: 'title',
};

export const postTagData = {
  Tag: 'tag',
};

export const tagData = {
  Tag: 'tag',
};

export const useRelationCallback = <T extends Query>(
  rel: { relationConfig: { query: T } },
  selectArr: (keyof T['shape'])[],
) => {
  const select = new Set(selectArr);

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
