import { ClientConfig } from 'pg';
import { PostgresOrm } from '../orm';
import { Pg } from '../pg.adapter';
import { Chat, ChatUser, Message, Profile, User } from './test-models';

export const pgConfig: ClientConfig = {
  connectionString: process.env.DATABASE_URL,
};

export const createPg = PostgresOrm(Pg(pgConfig));

export const testDb = createPg({
  user: User,
  profile: Profile,
  chat: Chat,
  chatUser: ChatUser,
  message: Message,
});