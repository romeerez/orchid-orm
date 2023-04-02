import { orchidORM } from '../orm';
import {
  ActiveUserWithProfile,
  ChatTable,
  MessageTable,
  PostTable,
  PostTagTable,
  ProfileTable,
  TagTable,
  UserTable,
} from './test-tables';

export const pgConfig = {
  databaseURL: process.env.PG_URL,
};

export const db = orchidORM(
  {
    ...pgConfig,
    log: false,
  },
  {
    user: UserTable,
    profile: ProfileTable,
    chat: ChatTable,
    message: MessageTable,
    post: PostTable,
    postTag: PostTagTable,
    tag: TagTable,
    activeUserWithProfile: ActiveUserWithProfile,
  },
);

export const adapter = db.$adapter;
