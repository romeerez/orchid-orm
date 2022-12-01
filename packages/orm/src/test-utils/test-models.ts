import { createModel } from '../model';
import { columnTypes } from 'pqb';
import { modelToZod } from 'orchid-orm-schema-to-zod';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    text: (min = 0, max = Infinity) => columnTypes.text(min, max),
    timestamp() {
      return columnTypes.timestamp().parse((input) => new Date(input));
    },
  },
});

export type User = UserModel['columns']['type'];
export class UserModel extends Model {
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

    messages: this.hasMany(() => MessageModel, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),

    chats: this.hasAndBelongsToMany(() => ChatModel, {
      primaryKey: 'id',
      foreignKey: 'userId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'chatId',
      joinTable: 'chatUser',
    }),
  };
}
export const UserSchema = modelToZod(UserModel);

export type Profile = ProfileModel['columns']['type'];
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

    chats: this.hasMany(() => ChatModel, {
      through: 'user',
      source: 'chats',
    }),
  };
}
export const ProfileSchema = modelToZod(ProfileModel);

export type Chat = ChatModel['columns']['type'];
export class ChatModel extends Model {
  table = 'chat';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    users: this.hasAndBelongsToMany(() => UserModel, {
      primaryKey: 'id',
      foreignKey: 'chatId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'userId',
      joinTable: 'chatUser',
    }),

    profiles: this.hasMany(() => ProfileModel, {
      through: 'users',
      source: 'profile',
    }),

    messages: this.hasMany(() => MessageModel, {
      primaryKey: 'id',
      foreignKey: 'chatId',
    }),
  };
}
export const ChatSchema = modelToZod(ChatModel);

export type Message = MessageModel['columns']['type'];
export class MessageModel extends Model {
  table = 'message';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer().foreignKey(() => ChatModel, 'id'),
    authorId: t
      .integer()
      .nullable()
      .foreignKey(() => UserModel, 'id'),
    text: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserModel, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),

    chat: this.belongsTo(() => ChatModel, {
      primaryKey: 'id',
      foreignKey: 'chatId',
    }),

    profile: this.hasOne(() => ProfileModel, {
      required: true,
      through: 'user',
      source: 'profile',
    }),
  };
}
export const MessageSchema = modelToZod(MessageModel);

export type Post = PostModel['columns']['type'];
export class PostModel extends Model {
  table = 'post';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey(() => UserModel, 'id'),
    title: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    postTags: this.hasMany(() => PostTagModel, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
export const PostSchema = modelToZod(PostModel);

export type PostTag = PostTagModel['columns']['type'];
export class PostTagModel extends Model {
  table = 'postTag';
  columns = this.setColumns((t) => ({
    postId: t.integer().foreignKey(() => PostModel, 'id'),
    tag: t.text().foreignKey(() => TagModel, 'tag'),
    ...t.primaryKey(['postId', 'tag']),
  }));

  relations = {
    tag: this.belongsTo(() => TagModel, {
      primaryKey: 'tag',
      foreignKey: 'tag',
    }),
  };
}
export const PostTagSchema = modelToZod(PostTagModel);

export type Tag = TagModel['columns']['type'];
export class TagModel extends Model {
  table = 'tag';
  columns = this.setColumns((t) => ({
    tag: t.text().primaryKey(),
  }));
}
