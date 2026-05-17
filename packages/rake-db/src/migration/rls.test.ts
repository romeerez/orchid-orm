import { expectSql, getDb, makeTestUpAndDown } from '../rake-db.test-utils';

const db = getDb();

describe('RLS table methods', () => {
  it('should enable and disable RLS', async () => {
    await makeTestUpAndDown('enableRls', 'disableRls')(
      (action) => db[action]('users'),
      () => expectSql(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY`),
      () => expectSql(`ALTER TABLE "users" DISABLE ROW LEVEL SECURITY`),
    );
  });

  it('should force and no-force RLS', async () => {
    await makeTestUpAndDown('forceRls', 'noForceRls')(
      (action) => db[action]('users'),
      () => expectSql(`ALTER TABLE "users" FORCE ROW LEVEL SECURITY`),
      () => expectSql(`ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY`),
    );
  });

  it('should support schema-qualified table names', async () => {
    await makeTestUpAndDown('enableRls', 'disableRls')(
      (action) => db[action]('auth.users'),
      () => expectSql(`ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY`),
      () => expectSql(`ALTER TABLE "auth"."users" DISABLE ROW LEVEL SECURITY`),
    );
  });
});
