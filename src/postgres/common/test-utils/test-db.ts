import { ClientConfig, Client } from 'pg';
import { PostgresOrm } from '../../orm/orm';
import { Pg } from '../../queryBuilder/adapter';
import {
  ChatModel,
  ChatUserModel,
  MessageModel,
  ProfileModel,
  UserModel,
} from './test-models';

export const pgConfig: ClientConfig = {
  connectionString: process.env.DATABASE_URL,
};

export const dbClient = new Client(pgConfig);

export const createPg = PostgresOrm(Pg(pgConfig));

export const db = createPg({
  user: UserModel,
  profile: ProfileModel,
  chat: ChatModel,
  chatUser: ChatUserModel,
  message: MessageModel,
});
