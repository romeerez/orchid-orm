import { createModel } from '../model';
import { columnTypes } from 'pqb';
import { modelToZod } from 'porm-schema-to-zod';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
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
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
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
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
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
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }));
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
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
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
