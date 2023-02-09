import {
  patchPgForTransactions,
  startTransaction,
  rollbackTransaction,
} from 'pg-transactional-tests';
import { db } from './src/test-utils';

jest.mock('pqb', () => require('../qb/pqb/src'), {
  virtual: true,
});
jest.mock('orchid-orm', () => require('../orm/src'), {
  virtual: true,
});
jest.mock('orchid-orm-schema-to-zod', () => require('../schema-to-zod/src'), {
  virtual: true,
});

patchPgForTransactions();

beforeAll(startTransaction);
beforeEach(startTransaction);
afterEach(rollbackTransaction);
afterAll(async () => {
  await rollbackTransaction();
  await db.$close();
});
