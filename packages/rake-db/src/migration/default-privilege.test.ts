import { expectSql, getDb, makeTestUpAndDown } from '../rake-db.test-utils';

const db = getDb();

describe('changeDefaultPrivileges', () => {
  it('should execute no SQL when both grant and revoke are not provided', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
        }),
      () => expectSql([]),
      () => expectSql([]),
    );
  });

  it('should generate GRANT SQL for tables with privileges', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'some_user',
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            tables: {
              privileges: ['SELECT', 'INSERT'],
              grantablePrivileges: ['UPDATE', 'DELETE'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" GRANT SELECT, INSERT ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" GRANT UPDATE, DELETE ON TABLES TO "some_role" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" REVOKE SELECT, INSERT ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" REVOKE UPDATE, DELETE ON TABLES FROM "some_role"`,
        ),
    );
  });

  it('should generate GRANT SQL for sequences with privileges', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            sequences: {
              privileges: ['USAGE'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT USAGE ON SEQUENCES TO "some_role"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE USAGE ON SEQUENCES FROM "some_role"',
        ),
    );
  });

  it('should generate GRANT SQL for functions with grantablePrivileges', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            functions: {
              grantablePrivileges: ['EXECUTE'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT EXECUTE ON FUNCTIONS TO "some_role" WITH GRANT OPTION',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE EXECUTE ON FUNCTIONS FROM "some_role"',
        ),
    );
  });

  it('should generate GRANT SQL for types', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            types: {
              privileges: ['USAGE'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT USAGE ON TYPES TO "some_role"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE USAGE ON TYPES FROM "some_role"',
        ),
    );
  });

  it('should generate REVOKE SQL only (no grant)', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          revoke: {
            tables: {
              privileges: ['DELETE'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE DELETE ON TABLES FROM "some_role"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT DELETE ON TABLES TO "some_role"',
        ),
    );
  });

  it('should generate SQL for multiple object types', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'admin',
          grantee: 'app_user',
          schema: 'app_schema',
          grant: {
            tables: {
              privileges: ['SELECT'],
            },
            sequences: {
              privileges: ['USAGE'],
            },
            functions: {
              grantablePrivileges: ['EXECUTE'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" GRANT SELECT ON TABLES TO "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" GRANT USAGE ON SEQUENCES TO "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" GRANT EXECUTE ON FUNCTIONS TO "app_user" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" REVOKE SELECT ON TABLES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" REVOKE USAGE ON SEQUENCES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "app_schema" REVOKE EXECUTE ON FUNCTIONS FROM "app_user"`,
        ),
    );
  });

  it('should filter out privileges that are also in grantablePrivileges', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'some_user',
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            tables: {
              privileges: ['SELECT', 'INSERT', 'UPDATE'],
              grantablePrivileges: ['UPDATE', 'DELETE'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" GRANT SELECT, INSERT ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" GRANT UPDATE, DELETE ON TABLES TO "some_role" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" REVOKE SELECT, INSERT ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "some_user" IN SCHEMA "some_schema" REVOKE UPDATE, DELETE ON TABLES FROM "some_role"`,
        ),
    );
  });

  it('should swap grant and revoke when rolling back (only grant provided)', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            tables: {
              privileges: ['SELECT'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT SELECT ON TABLES TO "some_role"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE SELECT ON TABLES FROM "some_role"',
        ),
    );
  });

  it('should swap grant and revoke when rolling back (only revoke provided)', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          revoke: {
            functions: {
              grantablePrivileges: ['EXECUTE'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE EXECUTE ON FUNCTIONS FROM "some_role"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT EXECUTE ON FUNCTIONS TO "some_role" WITH GRANT OPTION',
        ),
    );
  });

  it('should generate GRANT SQL with ALL PRIVILEGES for tables', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'admin',
          grantee: 'app_user',
          schema: 'public',
          grant: {
            tables: {
              privileges: ['ALL'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TABLES TO "app_user"',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM "app_user"',
        ),
    );
  });

  it('should generate GRANT SQL with ALL PRIVILEGES WITH GRANT OPTION', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            tables: {
              grantablePrivileges: ['ALL'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TABLES TO "some_role" WITH GRANT OPTION',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TABLES FROM "some_role"',
        ),
    );
  });

  it('should generate GRANT SQL with ALL PRIVILEGES for grantablePrivileges', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'admin',
          grantee: 'app_user',
          schema: 'public',
          grant: {
            tables: {
              grantablePrivileges: ['ALL'],
            },
          },
        }),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TABLES TO "app_user" WITH GRANT OPTION',
        ),
      () =>
        expectSql(
          'ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM "app_user"',
        ),
    );
  });

  it('should expand all to all object types with ALL PRIVILEGES', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'admin',
          grantee: 'app_user',
          schema: 'public',
          grant: {
            all: true,
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TABLES TO "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON SEQUENCES TO "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON FUNCTIONS TO "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TYPES TO "app_user"`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TYPES FROM "app_user"`,
        ),
    );
  });

  it('should expand allGrantable to all object types with ALL PRIVILEGES WITH GRANT OPTION', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantor: 'admin',
          grantee: 'app_user',
          schema: 'public',
          grant: {
            allGrantable: true,
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TABLES TO "app_user" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON SEQUENCES TO "app_user" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON FUNCTIONS TO "app_user" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" GRANT ALL PRIVILEGES ON TYPES TO "app_user" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE "admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TYPES FROM "app_user"`,
        ),
    );
  });

  it('should ignore all when allGrantable is set', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            all: true,
            allGrantable: true,
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TABLES TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON SEQUENCES TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
    );
  });

  it('should expand all in revoke', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          revoke: {
            all: true,
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON SEQUENCES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role"`,
        ),
    );
  });

  it('should merge object type configs on top of all', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            all: true,
            tables: {
              privileges: ['SELECT'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT SELECT ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON SEQUENCES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role"`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE SELECT ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
    );
  });

  it('should merge grantable object type configs on top of all', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            all: true,
            tables: {
              grantablePrivileges: ['ALL'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TABLES TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON SEQUENCES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role"`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
    );
  });

  it('should merge non-grantable object type configs on top of allGrantable', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            allGrantable: true,
            tables: {
              privileges: ['SELECT'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT SELECT ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON SEQUENCES TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role" WITH GRANT OPTION`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE SELECT ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
    );
  });

  it('should merge multiple object type configs on top of all', async () => {
    const testUpAndDown = makeTestUpAndDown('changeDefaultPrivileges');

    await testUpAndDown(
      (action) =>
        db[action]({
          grantee: 'some_role',
          schema: 'some_schema',
          grant: {
            all: true,
            tables: {
              privileges: ['SELECT'],
            },
            sequences: {
              grantablePrivileges: ['USAGE'],
            },
          },
        }),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT SELECT ON TABLES TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT USAGE ON SEQUENCES TO "some_role" WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" GRANT ALL PRIVILEGES ON TYPES TO "some_role"`,
        ),
      () =>
        expectSql(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE SELECT ON TABLES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE USAGE ON SEQUENCES FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM "some_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA "some_schema" REVOKE ALL PRIVILEGES ON TYPES FROM "some_role"`,
        ),
    );
  });
});
