import {
  createTableFactory,
  DefaultSelect,
  OrchidORM,
  OrchidOrmParam,
  OrchidORMSetupOptions,
  orchidORMWithAdapter,
  OrmTableThunks,
  Query,
} from 'orchid-orm';
import { Adapter, PickQueryQ } from 'pqb/internal';
import { now, testAdapter, testColumnTypes } from './test-utils';

export const { defineTable, defineView } = createTableFactory({
  snakeCase: true,
  columnTypes: testColumnTypes,
});

export type UserDataType = { name: string; tags: string[] };

export type UserDefaultSelect = DefaultSelect<typeof UserTable>;
export const UserTable = defineTable('User', { nameInDb: 'user' }, (t) => ({
  Id: t.name('id').identity().primaryKey(),
  Name: t.name('name').text(),
  UserKey: t.name('user_key').text(),
  Password: t.name('password').text().select(false),
  Picture: t.name('picture').text().nullable(),
  Data: t.name('data').json<UserDataType>().nullable(),
  Age: t.name('age').decimal().parse(parseInt).nullable(),
  Active: t.name('active').boolean().nullable(),
  Balance: t.name('balance').decimal().nullable(),
  ...t.timestamps(),
})).relations((user) => ({
  profile: user('Id', 'UserKey')
    .hasOne(() => ProfileTable('UserId', 'ProfileKey'))
    .required(),
  profileNoFkey: user('Id', 'UserKey')
    .hasOne(() => ProfileTable('UserIdNoFkey', 'ProfileKey'))
    .required(),
  activeProfile: user('Id', 'UserKey')
    .hasOne(() => ProfileTable('UserId', 'ProfileKey').where({ Active: true }))
    .required(),
  messages: user('Id', 'UserKey').hasMany(() =>
    MessageTable('AuthorId', 'MessageKey'),
  ),
  activeMessages: user('Id', 'UserKey').hasMany(() =>
    MessageTable('AuthorId', 'MessageKey').where({ Active: true }),
  ),
  chats: user('Id', 'UserKey')
    .hasAndBelongsToMany(() => ChatTable('IdOfChat', 'ChatKey'))
    .through('chatUser', ['userId', 'userKey'], ['chatId', 'chatKey']),
  activeChats: user('Id', 'UserKey')
    .hasAndBelongsToMany(() =>
      ChatTable('IdOfChat', 'ChatKey').where({ Active: true }),
    )
    .through('chatUser', ['userId', 'userKey'], ['chatId', 'chatKey']),
  posts: user('Id', 'UserKey').hasMany(() => PostTable('UserId', 'Title')),
  postsNoFkey: user('Id', 'UserKey').hasMany(() =>
    PostTable('UserIdNoFkey', 'Title'),
  ),
  activePosts: user('Id', 'UserKey').hasMany(() =>
    PostTable('UserId', 'Title').where({ Active: true }),
  ),
  onePost: user('Id', 'UserKey').hasOne(() => PostTable('UserId', 'Title')),
  activeOnePost: user('Id', 'UserKey').hasOne(() =>
    PostTable('UserId', 'Title').where({ Active: true }),
  ),
  postTags: user('Id', 'UserKey')
    .hasAndBelongsToMany(() => PostTagTable('PostId'))
    .through('post', ['userId', 'title'], ['id']),
  activePostTags: user('Id', 'UserKey')
    .hasAndBelongsToMany(() => PostTagTable('PostId').where({ Active: true }))
    .through('post', ['userId', 'title'], ['id']),
  tasks: user('Id', 'UserKey')
    .hasAndBelongsToMany(() => TaskTable('Id', 'TaskKey'))
    .through('user_task', ['userId', 'key'], ['taskId', 'key']),
}));

export const UserNoTimestampsTable = defineTable(
  'User',
  { schema: () => 'schema', id: 'userNoTimestamps' },
  (t) => ({
    Id: t.name('id').identity().primaryKey(),
    Name: t.name('name').string(),
    Password: t.name('password').string(),
  }),
);

export const TaskTable = defineTable('Task', { nameInDb: 'task' }, (t) => ({
  Id: t.name('id').identity().primaryKey(),
  UserId: t.name('user_id').integer().nullable(),
  TaskKey: t.name('task_key').text().nullable(),
  Title: t.name('title').text(),
  Done: t.name('done').boolean().default(false),
}));

export type Profile = DefaultSelect<typeof ProfileTable>;
export const ProfileTable = defineTable(
  'Profile',
  { nameInDb: 'profile' },
  (t) => ({
    Id: t.name('id').identity().primaryKey(),
    ProfileKey: t.name('profile_key').text(),
    UserId: t
      .name('user_id')
      .integer()
      .nullable()
      .unique()
      .foreignKey(() => UserTable, 'Id'),
    UserIdNoFkey: t.name('user_id_no_fkey').integer().nullable().select(false),
    Bio: t.name('bio').text().nullable(),
    Active: t.name('active').boolean().nullable(),
    ...t.timestamps(),
  }),
).relations((profile) => ({
  user: profile('UserId', 'ProfileKey').belongsTo(() =>
    UserTable('Id', 'UserKey'),
  ),
  activeUser: profile('UserId', 'ProfileKey').belongsTo(() =>
    UserTable('Id', 'UserKey').where({ Active: true }),
  ),
  chats: profile.hasMany(() => ChatTable.through('user', 'chats')),
  activeChats: profile.hasMany(() =>
    ChatTable.through('activeUser', 'activeChats'),
  ),
  messages: profile.hasMany(() => MessageTable.through('user', 'messages')),
  posts: profile.hasMany(() => PostTable.through('user', 'posts')),
  activePosts: profile.hasMany(() =>
    PostTable.through('activeUser', 'activePosts'),
  ),
  onePost: profile.hasOne(() => PostTable.through('user', 'onePost')),
  activeOnePost: profile.hasOne(() =>
    PostTable.through('activeUser', 'activeOnePost'),
  ),
  pic: profile('Id', 'ProfileKey').hasOne(() =>
    ProfilePicTable('ProfileId', 'ProfilePicKey'),
  ),
}));

const ProfilePicTable = defineTable(
  'profilePic',
  { nameInDb: 'profilePic' },
  (t) => ({
    Id: t.name('id').identity().primaryKey(),
    ProfilePicKey: t.name('profile_pic_key').text(),
    ProfileId: t
      .name('profile_id')
      .integer()
      .unique()
      .foreignKey(() => ProfileTable, 'Id'),
    Url: t.name('url').text(),
    ...t.timestamps(),
  }),
).relations((profilePic) => ({
  profile: profilePic('ProfileId', 'ProfilePicKey').belongsTo(() =>
    ProfileTable('Id', 'ProfileKey'),
  ),
}));

export type Chat = DefaultSelect<typeof ChatTable>;
export const ChatTable = defineTable('Chat', { nameInDb: 'chat' }, (t) => ({
  // a different id name to better test has and belongs to many
  IdOfChat: t.name('id_of_chat').identity().primaryKey(),
  ChatKey: t.name('chat_key').text(),
  Title: t.name('title').text(),
  Active: t.name('active').boolean().nullable(),
  ...t.timestamps(),
})).relations((chat) => ({
  users: chat('IdOfChat', 'ChatKey')
    .hasAndBelongsToMany(() => UserTable('Id', 'UserKey'))
    .through('chatUser', ['chatId', 'chatKey'], ['userId', 'userKey']),
  activeUsers: chat('IdOfChat', 'ChatKey')
    .hasAndBelongsToMany(() =>
      UserTable('Id', 'UserKey').where({ Active: true }),
    )
    .through('chatUser', ['chatId', 'chatKey'], ['userId', 'userKey']),
  profiles: chat.hasMany(() => ProfileTable.through('users', 'profile')),
  activeProfiles: chat.hasMany(() =>
    ProfileTable.through('activeUsers', 'activeProfile'),
  ),
  messages: chat('IdOfChat', 'ChatKey').hasMany(() =>
    MessageTable('ChatId', 'MessageKey'),
  ),
  activeMessages: chat('IdOfChat', 'ChatKey').hasMany(() =>
    MessageTable('ChatId', 'MessageKey').where({ Active: true }),
  ),
}));

export type Message = DefaultSelect<typeof MessageTable>;
export const MessageTable = defineTable(
  'Message',
  { nameInDb: 'message' },
  (t) => ({
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
  }),
)
  .softDelete('DeletedAt')
  .relations((message) => ({
    sender: message('AuthorId', 'MessageKey').belongsTo(() =>
      UserTable('Id', 'UserKey'),
    ),
    activeSender: message('AuthorId', 'MessageKey').belongsTo(() =>
      UserTable('Id', 'UserKey').where({ Active: true }),
    ),
    chat: message('ChatId', 'MessageKey').belongsTo(() =>
      ChatTable('IdOfChat', 'ChatKey'),
    ),
    activeChat: message('ChatId', 'MessageKey')
      .belongsTo(() => ChatTable('IdOfChat', 'ChatKey').where({ Active: true }))
      .required(false),
    profile: message
      .hasOne(() => ProfileTable.through('sender', 'profile'))
      .required(),
    activeProfile: message
      .hasOne(() => ProfileTable.through('activeSender', 'activeProfile'))
      .required(),
    profiles: message.hasMany(() => ProfileTable.through('sender', 'profile')),
    activeProfiles: message.hasMany(() =>
      ProfileTable.through('activeSender', 'activeProfile'),
    ),
  }));

export type Post = DefaultSelect<typeof PostTable>;
export const PostTable = defineTable('Post', { nameInDb: 'post' }, (t) => ({
  Id: t.name('id').identity().primaryKey(),
  UserId: t
    .name('user_id')
    .integer()
    .nullable()
    .foreignKey(() => UserTable, 'Id'),
  UserIdNoFkey: t.name('user_id_no_fkey').integer().nullable(),
  Active: t.name('active').boolean().nullable(),
  Body: t.name('body').text(),
  Title: t.name('title').text(),
  GeneratedTsVector: t
    .name('generated_ts_vector')
    .tsvector()
    .generated(['title', 'text'])
    .searchIndex()
    .select(false),
  ...t.timestamps(),
})).relations((post) => ({
  user: post('UserId', 'Title').belongsTo(() => UserTable('Id', 'UserKey')),
  activeUser: post('UserId', 'Title').belongsTo(() =>
    UserTable('Id', 'UserKey').where({ Active: true }),
  ),
  postTags: post('Id').hasMany(() => PostTagTable('PostId')),
  activePostTags: post('Id').hasMany(() =>
    PostTagTable('PostId').where({ Active: true }),
  ),
  onePostTag: post('Id').hasOne(() => PostTagTable('PostId')),
  activeOnePostTag: post('Id').hasOne(() =>
    PostTagTable('PostId').where({ Active: true }),
  ),
  tags: post.hasMany(() => TagTable.through('postTags', 'tag')),
  oneTag: post.hasOne(() => TagTable.through('onePostTag', 'tag')),
}));

export type PostTag = DefaultSelect<typeof PostTagTable>;
export const PostTagTable = defineTable('postTag', (t) => ({
  PostId: t
    .name('post_id')
    .integer()
    .foreignKey(() => PostTable, 'Id'),
  Tag: t
    .name('tag')
    .text()
    .foreignKey(() => TagTable, 'Tag'),
  Active: t.name('active').boolean().nullable(),
}))
  .primaryKey(['PostId', 'Tag'])
  .relations((postTag) => ({
    post: postTag('PostId').belongsTo(() => PostTable('Id')),
    activePost: postTag('PostId').belongsTo(() =>
      PostTable('Id').where({ Active: true }),
    ),
    tag: postTag('Tag').belongsTo(() => TagTable('Tag')),
  }));

export type Tag = DefaultSelect<typeof TagTable>;
export const TagTable = defineTable('Tag', { nameInDb: 'tag' }, (t) => ({
  Tag: t.name('tag').text().primaryKey(),
})).relations((tag) => ({
  postTags: tag('Tag').hasMany(() => PostTagTable('Tag')),
}));

export const Product = defineTable('Product', (t) => ({
  id: t.identity().primaryKey(),
  camelCase: t.name('camel_case').text().nullable(),
  priceAmount: t.name('price_amount').decimal(),
}));

export const ActiveUserView = defineView(
  'activeUser',
  {
    nameInDb: 'activeUser',
    sql: `
      SELECT "user".*
      FROM "schema"."user"
      WHERE "user"."active"
    `,
  },
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json<{ name: string; tags: string[] }>().nullable(),
    age: t.integer().nullable(),
    active: t.boolean(),
    ...t.timestamps(),
  }),
).relations((activeUser) => ({
  user: activeUser('id').belongsTo(() => UserTable('Id')),

  profile: activeUser('id').hasOne(() => ProfileTable('UserId')),

  profilePic: activeUser.hasOne(() =>
    ProfilePicTable.through('profile', 'pic'),
  ),

  profiles: activeUser('id').hasMany(() => ProfileTable('UserId')),

  posts: activeUser.hasMany(() => PostTable.through('user', 'posts')),

  chats: activeUser('id')
    .hasAndBelongsToMany(() => ChatTable('IdOfChat'))
    .through('chatUser', 'userId', 'chatId'),

  writableActiveUser: activeUser('id').hasOne(() =>
    WritableActiveUserView('id'),
  ),
}));

export const WritableActiveUserView = defineView(
  'activeUser',
  {
    nameInDb: 'activeUser',
    readOnly: false,
    sql: `
      SELECT "user".*
      FROM "schema"."user"
      WHERE "user"."active"
    `,
  },
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json<{ name: string; tags: string[] }>().nullable(),
    age: t.integer().nullable(),
    active: t
      .boolean()
      .readOnly()
      .setOnSave(() => true),
    ...t.timestamps(),
  }),
).relations((activeUser) => ({
  profile: activeUser('id').hasOne(() => ProfileTable('UserId')),

  profiles: activeUser('id').hasMany(() => ProfileTable('UserId')),
}));

export const ActiveUserWithProfileView = defineView(
  'activeUserWithProfile',
  {
    sql: `
      SELECT "user".*, p.bio
      FROM "schema"."user"
      JOIN "schema"."profile" p on "user".id = p."user_id"
      WHERE "user"."active"
    `,
  },
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    bio: t.text().nullable(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json<{ name: string; tags: string[] }>().nullable(),
    age: t.integer().nullable(),
    active: t.boolean(),
    ...t.timestamps(),
  }),
);

const CategoryTable = defineTable('Category', (t) => ({
  categoryName: t.text().primaryKey(),
  parentName: t.text().nullable(),
  ...t.timestamps(),
})).relations((category) => ({
  category: category('parentName').belongsTo(() =>
    CategoryTable('categoryName'),
  ),
}));

export const UniqueTable = defineTable('uniqueTable', (t) => ({
  id: t.identity().primaryKey(),
  one: t.text().unique().primaryKey(),
  two: t.integer().unique(),
  thirdColumn: t.text(),
  fourthColumn: t.integer(),
})).unique(['thirdColumn', 'fourthColumn']);

export function testOrchidORMWithAdapter<T extends OrmTableThunks>(
  tables: T,
): OrchidORM<T>;
export function testOrchidORMWithAdapter<
  T extends OrmTableThunks,
  V extends OrmTableThunks,
>(
  options: OrchidOrmParam<
    ({ db: Query } | { adapter: Adapter }) & OrchidORMSetupOptions<V>
  >,
  tables: T,
): OrchidORM<T, V>;
export function testOrchidORMWithAdapter<
  T extends OrmTableThunks,
  V extends OrmTableThunks,
>(
  optionsOrTables:
    | T
    | OrchidOrmParam<
        ({ db: Query } | { adapter: Adapter }) & OrchidORMSetupOptions<V>
      >,
  tables?: T,
): OrchidORM<T, V> {
  if (tables) {
    return orchidORMWithAdapter(optionsOrTables as never, tables);
  }

  return orchidORMWithAdapter({ adapter: testAdapter }, optionsOrTables as T);
}

export const db = orchidORMWithAdapter(
  {
    adapter: testAdapter,
    log: !process.env.CI,
    schema: () => 'schema',
    views: {
      activeUser: ActiveUserView,
      writableActiveUser: WritableActiveUserView,
      activeUserWithProfile: ActiveUserWithProfileView,
    },
  },
  {
    user: UserTable,
    userNoTimestamps: UserNoTimestampsTable,
    profile: ProfileTable,
    profilePic: ProfilePicTable,
    chat: ChatTable,
    message: MessageTable,
    post: PostTable,
    postTag: PostTagTable,
    tag: TagTable,
    product: Product,
    category: CategoryTable,
    task: TaskTable,
    uniqueTable: UniqueTable,
  },
);

export const UserData = {
  Name: 'name',
  UserKey: 'key',
  Password: 'password',
  updatedAt: now,
  createdAt: now,
};

export const ProfileData = {
  Bio: 'bio',
  ProfileKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const ChatData = {
  Title: 'title',
  ChatKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const MessageData = {
  Text: 'text',
  MessageKey: 'key',
  updatedAt: now,
  createdAt: now,
};

export const PostData = {
  Body: 'body',
  Title: 'title',
};

export const PostTagData = {
  Tag: 'tag',
};

export const TagData = {
  Tag: 'tag',
};

export const TaskData = {
  Title: 'title',
  TaskKey: 'key',
};

const selectAllAs = (as: string, table: PickQueryQ) =>
  `"${as}".${table.q.selectAllColumns!.join(`, "${as}".`)}`;

export const UserSelectAll = db.user.q.selectAllColumns!.join(', ');
export const UserSelectAllWithTable = selectAllAs('User', db.user);

export const ProfileSelectAll = db.profile.q.selectAllColumns!.join(', ');
export const ProfileSelectAllWithTable = selectAllAs('Profile', db.profile);

export const PostColumnsSql = db.post.q.selectAllColumns!.join(', ');

export const MessageColumnsSql = db.message.q.selectAllColumns!.join(', ');
export const MessageJsonBuildObject = (as: string) =>
  `CASE WHEN to_jsonb("${as}") IS NULL THEN NULL ELSE json_build_object(${Object.keys(
    db.message.q.selectAllShape!,
  )
    .map((c) => `'${c}', "${as}"."${c}"${c === 'Decimal' ? '::text' : ''}`)
    .join(', ')}) END "${as}"`;
