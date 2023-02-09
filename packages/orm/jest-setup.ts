jest.mock('pqb', () => require('../qb/pqb/src'), {
  virtual: true,
});

jest.mock('rake-db', () => require('../rake-db/src'), {
  virtual: true,
});

jest.mock('orchid-orm-schema-to-zod', () => require('../schema-to-zod/src'), {
  virtual: true,
});
