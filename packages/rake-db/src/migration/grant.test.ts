import { changeGrant, GrantMigrationArg } from './grant';
import { makeDb, queryMock } from '../rake-db.test-utils';

const callGrant = async (up: boolean, params: GrantMigrationArg) => {
  const db = {
    up,
    adapter: { arrays: queryMock, getSchema: () => undefined },
  } as unknown as Parameters<typeof changeGrant>[0];
  return changeGrant(db, up, params);
};

describe('changeGrant', () => {
  beforeEach(() => {
    queryMock.mockClear();
  });

  describe('grant', () => {
    it('should grant privileges on schemas', async () => {
      await callGrant(true, {
        to: 'app_user',
        schemas: ['public'],
        privileges: ['USAGE', 'CREATE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT USAGE, CREATE ON SCHEMA "public" TO "app_user"',
      );
    });

    it('should grant privileges on tables', async () => {
      await callGrant(true, {
        to: 'app_user',
        tables: ['users', 'posts'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users", "posts" TO "app_user"',
      );
    });

    it('should grant privileges on all tables in schema', async () => {
      await callGrant(true, {
        to: 'app_user',
        allTablesIn: ['app_schema'],
        privileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON ALL TABLES IN SCHEMA "app_schema" TO "app_user"',
      );
    });

    it('should grant privileges on sequences', async () => {
      await callGrant(true, {
        to: 'app_user',
        sequences: ['user_id_seq', 'post_id_seq'],
        privileges: ['USAGE', 'SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT USAGE, SELECT ON SEQUENCE "user_id_seq", "post_id_seq" TO "app_user"',
      );
    });

    it('should grant privileges on all sequences in schema', async () => {
      await callGrant(true, {
        to: 'app_user',
        allSequencesIn: ['app_schema'],
        privileges: ['USAGE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT USAGE ON ALL SEQUENCES IN SCHEMA "app_schema" TO "app_user"',
      );
    });

    it('should grant privileges on all routines in schema', async () => {
      await callGrant(true, {
        to: 'app_user',
        allRoutinesIn: ['app_schema'],
        privileges: ['EXECUTE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT EXECUTE ON ALL ROUTINES IN SCHEMA "app_schema" TO "app_user"',
      );
    });

    it('should grant privileges on types', async () => {
      await callGrant(true, {
        to: 'app_user',
        types: ['address', 'phone'],
        privileges: ['USAGE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT USAGE ON TYPE "address", "phone" TO "app_user"',
      );
    });

    it('should grant privileges on domains', async () => {
      await callGrant(true, {
        to: 'app_user',
        domains: ['email_domain'],
        privileges: ['USAGE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT USAGE ON DOMAIN "email_domain" TO "app_user"',
      );
    });

    it('should grant privileges on databases', async () => {
      await callGrant(true, {
        to: 'app_user',
        databases: ['my_db'],
        privileges: ['CONNECT', 'CREATE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT CONNECT, CREATE ON DATABASE "my_db" TO "app_user"',
      );
    });

    it('should grant with grant option', async () => {
      await callGrant(true, {
        to: 'app_user',
        tables: ['users'],
        grantablePrivileges: ['SELECT', 'INSERT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT, INSERT ON TABLE "users" TO "app_user" WITH GRANT OPTION',
      );
    });

    it('should grant to multiple roles', async () => {
      await callGrant(true, {
        to: ['user1', 'user2'],
        tables: ['users'],
        privileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON TABLE "users" TO "user1", "user2"',
      );
    });

    it('should grant to PUBLIC without quoting it as a role', async () => {
      await callGrant(true, {
        to: 'PUBLIC',
        tables: ['users'],
        privileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON TABLE "users" TO PUBLIC',
      );
    });

    it('should grant with grantedBy', async () => {
      await callGrant(true, {
        to: 'app_user',
        tables: ['users'],
        privileges: ['SELECT'],
        grantedBy: 'admin',
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON TABLE "users" TO "app_user" GRANTED BY "admin"',
      );
    });

    it('should generate no SQL when no privileges provided', async () => {
      await callGrant(true, {
        to: 'app_user',
      } as GrantMigrationArg);

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('should grant ALL PRIVILEGES', async () => {
      await callGrant(true, {
        to: 'app_user',
        tables: ['users'],
        privileges: ['ALL'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT ALL PRIVILEGES ON TABLE "users" TO "app_user"',
      );
    });

    it('should grant TEMP as TEMPORARY', async () => {
      await callGrant(true, {
        to: 'app_user',
        databases: ['my_db'],
        privileges: ['TEMP'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT TEMPORARY ON DATABASE "my_db" TO "app_user"',
      );
    });

    it('should apply default schema to unqualified table names', async () => {
      const dbWithSchema = {
        up: true,
        adapter: { arrays: queryMock, getSchema: () => 'app_schema' },
      } as unknown as Parameters<typeof changeGrant>[0];

      await changeGrant(dbWithSchema, true, {
        to: 'app_user',
        tables: ['users'],
        privileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON TABLE "app_schema"."users" TO "app_user"',
      );
    });
  });

  describe('revoke', () => {
    it('should revoke grantable privileges in up and grant them with grant option in down', async () => {
      const db = makeDb();

      db.up = true;
      await db.revoke({
        to: 'app_user',
        tables: ['users'],
        grantablePrivileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'REVOKE SELECT ON TABLE "users" FROM "app_user"',
      );

      queryMock.mockClear();
      db.up = false;
      await db.revoke({
        to: 'app_user',
        tables: ['users'],
        grantablePrivileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'GRANT SELECT ON TABLE "users" TO "app_user" WITH GRANT OPTION',
      );
    });

    it('should revoke privileges on schemas', async () => {
      await callGrant(false, {
        to: 'app_user',
        schemas: ['public'],
        privileges: ['USAGE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'REVOKE USAGE ON SCHEMA "public" FROM "app_user"',
      );
    });

    it('should revoke with CASCADE', async () => {
      await callGrant(false, {
        to: 'PUBLIC',
        routines: ['public.reset_password(text)'],
        privileges: ['EXECUTE'],
        revokeMode: 'CASCADE',
      });

      expect(queryMock).toHaveBeenCalledWith(
        'REVOKE EXECUTE ON ROUTINE "public"."reset_password(text)" FROM PUBLIC CASCADE',
      );
    });

    it('should revoke with RESTRICT', async () => {
      await callGrant(false, {
        to: 'readonly',
        tables: ['project'],
        grantablePrivileges: ['UPDATE'],
        revokeMode: 'RESTRICT',
      });

      expect(queryMock).toHaveBeenCalledWith(
        'REVOKE UPDATE ON TABLE "project" FROM "readonly" RESTRICT',
      );
    });

    it('should revoke grantable privileges', async () => {
      await callGrant(false, {
        to: 'app_user',
        tables: ['users'],
        grantablePrivileges: ['SELECT'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        'REVOKE SELECT ON TABLE "users" FROM "app_user"',
      );
    });

    it('should revoke both privileges and grantablePrivileges separately', async () => {
      await callGrant(false, {
        to: 'app_user',
        tables: ['users'],
        privileges: ['SELECT', 'INSERT'],
        grantablePrivileges: ['UPDATE'],
      });

      expect(queryMock).toHaveBeenCalledWith(
        `REVOKE SELECT, INSERT ON TABLE "users" FROM "app_user";
REVOKE UPDATE ON TABLE "users" FROM "app_user"`,
      );
    });
  });
});
