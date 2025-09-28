import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

jest.mock('orchid-core', () => require('./packages/core/src'), {
  virtual: true,
});

jest.mock('orchid-orm', () => require('./packages/orm/src'), {
  virtual: true,
});

jest.mock('pqb', () => require('./packages/qb/pqb/src'), {
  virtual: true,
});

jest.mock(
  'pqb/node-postgres',
  () => require('./packages/qb/pqb/src/adapters/node-postgres'),
  {
    virtual: true,
  },
);

jest.mock(
  'pqb/postgres-js',
  () => require('./packages/qb/pqb/src/adapters/postgres-js'),
  {
    virtual: true,
  },
);

jest.mock('rake-db', () => require('./packages/rake-db/src'), {
  virtual: true,
});

jest.mock(
  'orchid-orm-schema-to-zod',
  () => require('./packages/schemaConfigs/zod/src'),
  {
    virtual: true,
  },
);

jest.mock(
  'orchid-orm-valibot',
  () => require('./packages/schemaConfigs/valibot/src'),
  {
    virtual: true,
  },
);

jest.mock('test-utils', () => require('./packages/test-utils/src'), {
  virtual: true,
});
