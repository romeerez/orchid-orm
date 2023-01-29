import { createBaseTable } from '../table';
import { tableToZod } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
    timestamp() {
      return t.timestamp().parse((input) => new Date(input));
    },
  }),
});

export type User = UserTable['columns']['type'];
export class UserTable extends BaseTable {
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

    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),

    chats: this.hasAndBelongsToMany(() => ChatTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'chatId',
      joinTable: 'chatUser',
    }),
  };
}
export const UserSchema = tableToZod(UserTable);

export type Profile = ProfileTable['columns']['type'];
export class ProfileTable extends BaseTable {
  table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'id'),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
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
  table = 'chat';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    users: this.hasAndBelongsToMany(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'chatId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'userId',
      joinTable: 'chatUser',
    }),

    profiles: this.hasMany(() => ProfileTable, {
      through: 'users',
      source: 'profile',
    }),

    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'id',
      foreignKey: 'chatId',
    }),
  };
}
export const ChatSchema = tableToZod(ChatTable);

export type Message = MessageTable['columns']['type'];
export class MessageTable extends BaseTable {
  table = 'message';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer().foreignKey(() => ChatTable, 'id'),
    authorId: t
      .integer()
      .nullable()
      .foreignKey(() => UserTable, 'id'),
    text: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),

    chat: this.belongsTo(() => ChatTable, {
      primaryKey: 'id',
      foreignKey: 'chatId',
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
  table = 'post';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey(() => UserTable, 'id'),
    title: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    postTags: this.hasMany(() => PostTagTable, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
export const PostSchema = tableToZod(PostTable);

export type PostTag = PostTagTable['columns']['type'];
export class PostTagTable extends BaseTable {
  table = 'postTag';
  columns = this.setColumns((t) => ({
    postId: t.integer().foreignKey(() => PostTable, 'id'),
    tag: t.text().foreignKey(() => TagTable, 'tag'),
    ...t.primaryKey(['postId', 'tag']),
  }));

  relations = {
    tag: this.belongsTo(() => TagTable, {
      primaryKey: 'tag',
      foreignKey: 'tag',
    }),
  };
}
export const PostTagSchema = tableToZod(PostTagTable);

export type Tag = TagTable['columns']['type'];
export class TagTable extends BaseTable {
  table = 'tag';
  columns = this.setColumns((t) => ({
    tag: t.text().primaryKey(),
  }));
}
