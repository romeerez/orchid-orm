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

describe('RLS policy methods', () => {
  it('should create and drop policy', async () => {
    await makeTestUpAndDown('createPolicy', 'dropPolicy')(
      (action) =>
        db[action]('project', 'project_select_same_tenant', {
          as: 'PERMISSIVE',
          for: 'SELECT',
          to: ['app_user', 'app_admin'],
          using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        }),
      () =>
        expectSql(`
          CREATE POLICY "project_select_same_tenant"
          ON "project"
          AS PERMISSIVE
          FOR SELECT
          TO "app_user", "app_admin"
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        `),
      () =>
        expectSql(`
          DROP POLICY "project_select_same_tenant" ON "project"
        `),
    );
  });

  it('should support schema-qualified table names', async () => {
    await makeTestUpAndDown('createPolicy', 'dropPolicy')(
      (action) =>
        db[action]('auth.project', 'project_insert_same_tenant', {
          as: 'RESTRICTIVE',
          for: 'INSERT',
          to: 'app_user',
          withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        }),
      () =>
        expectSql(`
          CREATE POLICY "project_insert_same_tenant"
          ON "auth"."project"
          AS RESTRICTIVE
          FOR INSERT
          TO "app_user"
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
        `),
      () =>
        expectSql(`
          DROP POLICY "project_insert_same_tenant" ON "auth"."project"
        `),
    );
  });

  it('should alter policy directly when changing supported fields', async () => {
    await makeTestUpAndDown('changePolicy')(
      (action) =>
        db[action]('project', 'project_select_same_tenant', {
          from: {
            name: 'project_select_same_tenant',
            to: ['app_user'],
            using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
            withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
          },
          to: {
            name: 'project_select_same_tenant_v2',
            to: ['app_user', 'app_admin'],
            using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL`,
            withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL`,
          },
        }),
      () =>
        expectSql([
          `
            ALTER POLICY "project_select_same_tenant"
            ON "project"
            RENAME TO "project_select_same_tenant_v2"
          `,
          `
            ALTER POLICY "project_select_same_tenant_v2"
            ON "project"
            TO "app_user", "app_admin"
          `,
          `
            ALTER POLICY "project_select_same_tenant_v2"
            ON "project"
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL)
          `,
          `
            ALTER POLICY "project_select_same_tenant_v2"
            ON "project"
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL)
          `,
        ]),
      () =>
        expectSql([
          `
            ALTER POLICY "project_select_same_tenant_v2"
            ON "project"
            RENAME TO "project_select_same_tenant"
          `,
          `
            ALTER POLICY "project_select_same_tenant"
            ON "project"
            TO "app_user"
          `,
          `
            ALTER POLICY "project_select_same_tenant"
            ON "project"
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          `,
          `
            ALTER POLICY "project_select_same_tenant"
            ON "project"
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
          `,
        ]),
    );
  });

  it('should recreate policy when mode, command, or table changes', async () => {
    await makeTestUpAndDown('changePolicy')(
      (action) =>
        db[action]('project', 'project_access', {
          from: {
            as: 'PERMISSIVE',
            for: 'SELECT',
            to: 'app_user',
            using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
          },
          to: {
            table: 'auth.project_archive',
            name: 'project_access_archive',
            as: 'RESTRICTIVE',
            for: 'UPDATE',
            to: ['app_user', 'app_admin'],
            using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL`,
            withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL`,
          },
        }),
      () =>
        expectSql([
          `
            DROP POLICY "project_access" ON "project"
          `,
          `
            CREATE POLICY "project_access_archive"
            ON "auth"."project_archive"
            AS RESTRICTIVE
            FOR UPDATE
            TO "app_user", "app_admin"
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL)
          `,
        ]),
      () =>
        expectSql([
          `
            DROP POLICY "project_access_archive" ON "auth"."project_archive"
          `,
          `
            CREATE POLICY "project_access"
            ON "project"
            AS PERMISSIVE
            FOR SELECT
            TO "app_user"
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          `,
        ]),
    );
  });
});
