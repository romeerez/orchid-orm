import { createBaseTable } from '../table';
import { tableToZod } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text(min = 0, max = Infinity) {
      return t.text.call(this, min, max);
    },
    timestamp() {
      return t.timestamp.call(this).parse((input) => new Date(input));
    },
  }),
});

export type User = UserTable['columns']['type'];
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    Id: t.name('id').serial().primaryKey(),
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

export type Profile = ProfileTable['columns']['type'];
export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    Id: t.name('id').serial().primaryKey(),
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

export type Chat = ChatTable['columns']['type'];
export class ChatTable extends BaseTable {
  readonly table = 'chat';
  columns = this.setColumns((t) => ({
    // a different id name to better test has and belongs to many
    IdOfChat: t.name('idOfChat').serial().primaryKey(),
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

export type Message = MessageTable['columns']['type'];
export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    Id: t.name('id').serial().primaryKey(),
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

export type Post = PostTable['columns']['type'];
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    Id: t.name('id').serial().primaryKey(),
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

export type PostTag = PostTagTable['columns']['type'];
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

export type Tag = TagTable['columns']['type'];
export class TagTable extends BaseTable {
  readonly table = 'tag';
  columns = this.setColumns((t) => ({
    Tag: t.name('tag').text().primaryKey(),
  }));
}
