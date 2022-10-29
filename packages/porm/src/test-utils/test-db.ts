import { Client } from 'pg';
import { porm } from '../orm';
import {
  ChatModel,
  MessageModel,
  PostModel,
  PostTagModel,
  ProfileModel,
  TagModel,
  UserModel,
} from './test-models';

export const pgConfig = {
  connectionString: process.env.DATABASE_URL,
};

export const dbClient = new Client(pgConfig);

export const db = porm(
  {
    ...pgConfig,
    log: false,
  },
  {
    user: UserModel,
    profile: ProfileModel,
    chat: ChatModel,
    message: MessageModel,
    post: PostModel,
    postTag: PostTagModel,
    tag: TagModel,
  },
);

export const adapter = db.adapter;
