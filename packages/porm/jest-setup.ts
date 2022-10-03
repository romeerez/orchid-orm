jest.mock('pqb', () => require('../pqb/src'), {
  virtual: true,
});

jest.mock('porm-schema-to-zod', () => require('../schema-to-zod/src'), {
  virtual: true,
});
