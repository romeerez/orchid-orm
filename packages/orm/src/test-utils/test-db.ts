import { orchidORM } from '../orm';
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
  databaseURL: process.env.DATABASE_URL,
};

export const db = orchidORM(
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

export const adapter = db.$adapter;
