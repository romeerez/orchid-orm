import { model } from '../model';

export class User extends model({
  table: 'user',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  })
}) {}

export class Profile extends model({
  table: 'profile',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
    bio: t.text().nullable(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  })
}) {}

export class Chat extends model({
  table: 'chat',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }),
}) {}

export class ChatUser extends model({
  table: 'chatUser',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer(),
    userId: t.integer(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }),
}) {}

export class Message extends model({
  table: 'message',
  schema: (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer(),
    authorId: t.integer(),
    text: t.text(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  })
}) {}
