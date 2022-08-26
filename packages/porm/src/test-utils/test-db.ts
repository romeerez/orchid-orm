import { Client } from 'pg';
import { Adapter } from 'pqb';
import { porm } from '../orm';
import {
  ChatModel,
  MessageModel,
  ProfileModel,
  UserModel,
} from './test-models';

export const pgConfig = {
  connectionString: process.env.DATABASE_URL,
};

export const dbClient = new Client(pgConfig);

export const adapter = Adapter(pgConfig);

export const db = porm(adapter)({
  user: UserModel,
  profile: ProfileModel,
  chat: ChatModel,
  message: MessageModel,
});
