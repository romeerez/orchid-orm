import {
  createTableFactory,
  orchidORMWithAdapter,
  Selectable,
} from 'orchid-orm';
import { testAdapter } from 'test-utils';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { z } from 'zod/v4';

const { defineTable } = createTableFactory({
  snakeCase: true,
  schemaConfig: zodSchemaConfig,
  columnTypes: (t) => ({
    ...t,
    timestamp: () => t.timestamp().asNumber(),
  }),
});

export { defineTable };

export type User = Selectable<typeof UserTable>;
const UserTable = defineTable('user', { schema: () => 'schema' }, (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  password: t.text(),
  picture: t.text().nullable(),
  data: t
    .json(
      z.object({
        name: z.string(),
        tags: z.string().array(),
      }),
    )
    .nullable(),
  age: t.integer().nullable(),
  active: t.boolean().nullable(),
  ...t.timestamps(),
})).relations((user) => ({
  profile: user('id')
    .hasOne(() => ProfileTable('userId'))
    .required(),
}));

export type Profile = Selectable<typeof ProfileTable>;
export const ProfileTable = defineTable(
  'profile',
  { schema: () => 'schema' },
  (t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().nullable(),
    bio: t.text().min(100).max(100000),
    ...t.timestamps(),
  }),
).relations((profile) => ({
  user: profile('userId')
    .belongsTo(() => UserTable('id'))
    .required(),
}));

export const db = orchidORMWithAdapter(
  {
    adapter: testAdapter,
    log: false,
  },
  {
    user: UserTable,
    profile: ProfileTable,
  },
);
