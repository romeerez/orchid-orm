import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

jest.mock('orchid-orm', () => require('./packages/orm/src'), {
  virtual: true,
});

jest.mock('pqb', () => require('./packages/qb/pqb/src'), {
  virtual: true,
});

jest.mock('rake-db', () => require('./packages/rake-db/src'), {
  virtual: true,
});

jest.mock(
  'orchid-orm-schema-to-zod',
  () => require('./packages/schema-to-zod/src'),
  {
    virtual: true,
  },
);
