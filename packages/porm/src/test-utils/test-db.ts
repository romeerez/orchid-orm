import { Client } from 'pg';
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

export const db = porm(
  { ...pgConfig, log: true },
  {
    user: UserModel,
    profile: ProfileModel,
    chat: ChatModel,
    message: MessageModel,
  },
);

export const adapter = db.adapter;
