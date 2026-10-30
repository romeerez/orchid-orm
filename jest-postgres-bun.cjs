// Jest under Bun loads postgres.js v4 as an ES module, which has no `__esModule`,
// so a transpiled default import of `postgres` would get the whole namespace.
module.exports = {
  __esModule: true,
  ...require('./packages/pqb/node_modules/postgres'),
};
