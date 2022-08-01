import { model } from '../model';
import { columnTypes } from 'pqb';

const timestampAsDate = columnTypes
  .timestamp()
  .parse((input) => new Date(input))
  .encode((date: Date) => date.toISOString());

export type User = UserModel['type'];
export class UserModel extends model({
  table: 'user',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }),
}) {}

export type Profile = ProfileModel['type'];
export class ProfileModel extends model({
  table: 'profile',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
    bio: t.text().nullable(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }),
}) {
  user = this.belongsTo(() => UserModel, {
    primaryKey: 'id',
    foreignKey: 'userId',
  });
}

export type Chat = ChatModel['type'];
export class ChatModel extends model({
  table: 'chat',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }),
}) {}

export type ChatUser = ChatUserModel['type'];
export class ChatUserModel extends model({
  table: 'chatUser',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer(),
    userId: t.integer(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }),
}) {}

export type Message = MessageModel['type'];
export class MessageModel extends model({
  table: 'message',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer(),
    authorId: t.integer(),
    text: t.text(),
    createdAt: timestampAsDate,
    updatedAt: timestampAsDate,
  }),
}) {}
