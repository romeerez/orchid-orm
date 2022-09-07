import { Model } from '../model';
import { columnTypes } from 'pqb';

const timestampAsDate = columnTypes
  .timestamp()
  .parse((input) => new Date(input))
  .encode((date: Date) => date.toISOString());

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
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
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

export type Profile = ProfileModel['columns']['type'];
export class ProfileModel extends Model {
  table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
    bio: t.text().nullable(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
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

export type Chat = ChatModel['columns']['type'];
export class ChatModel extends Model {
  table = 'chat';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }));
}

export type Message = MessageModel['columns']['type'];
export class MessageModel extends Model {
  table = 'message';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer(),
    authorId: t.integer(),
    text: t.text(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }));

  relations = {
    user: this.belongsTo(() => UserModel, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),

    profile: this.hasOne(() => ProfileModel, {
      required: true,
      through: 'user',
      source: 'profile',
    }),
  };
}
