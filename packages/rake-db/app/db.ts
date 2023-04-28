import { orchidORM } from 'orchid-orm';
import { UserTable } from './tables/user';
import { ProfileTable } from './tables/profile';
import { ChatTable } from './tables/chat';
import { ChatUserTable } from './tables/chatUser';
import { MessageTable } from './tables/message';
import { CountryTable } from './tables/country';
import { CityTable } from './tables/city';
import { UniqueTableTable } from './tables/uniqueTable';
import { SnakeTable } from './tables/snake';

export const db = orchidORM(
  {
    databaseURL: process.env.PG_URL,
  },
  {
    user: UserTable,
    profile: ProfileTable,
    chat: ChatTable,
    chatUser: ChatUserTable,
    message: MessageTable,
    country: CountryTable,
    city: CityTable,
    uniqueTable: UniqueTableTable,
    snake: SnakeTable,
  },
);
