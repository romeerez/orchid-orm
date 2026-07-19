import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
  RawDbStructure,
} from './db-structure';
import { dbStructureMockFactory } from './db-structure.mockFactory';
import { asMock, TestAdapter } from 'test-utils';
import { AdapterClass } from 'pqb/internal';

const defaultPrivilege = (
  data: Partial<RawDbStructure.DefaultPrivilege> = {},
): RawDbStructure.DefaultPrivilege => ({
  grantor: 'postgres',
  grantee: 'app_user',
  schema: 'public',
  object: 'relation',
  privileges: ['SELECT', 'INSERT'],
  isGrantables: [false, true],
  ...data,
});

const grant = (
  data: Partial<RawDbStructure.Grant> = {},
): RawDbStructure.Grant => ({
  grantor: 'postgres',
  grantee: 'app_user',
  schema: 'public',
  name: 'table',
  target: 'tables',
  privileges: ['INSERT', 'SELECT'],
  isGrantables: [true, false],
  ...data,
});

const rlsPolicy = (
  data: Partial<RawDbStructure.RlsPolicy> = {},
): RawDbStructure.RlsPolicy => ({
  schemaName: 'public',
  tableName: 'table',
  name: 'table_select_policy',
  mode: 'PERMISSIVE',
  command: 'SELECT',
  roles: ['app_user'],
  using: "(tenant_id = current_setting('app.tenant_id', true)::uuid)",
  withCheck: undefined,
  ...data,
});

const adapter = new AdapterClass({
  driverAdapter: TestAdapter,
  config: { databaseURL: process.env.PG_URL },
});

const sortGrants = (grants: DbStructure.Grant[]) =>
  [...grants].sort((a, b) =>
    getGrantTarget(a).localeCompare(getGrantTarget(b)),
  );

const getGrantTarget = (grant: DbStructure.Grant) => {
  if (grant.databases) return `databases:${grant.databases[0]}`;
  if (grant.domains) return `domains:${grant.domains[0]}`;
  if (grant.routines) return `routines:${grant.routines[0]}`;
  if (grant.schemas) return `schemas:${grant.schemas[0]}`;
  if (grant.sequences) return `sequences:${grant.sequences[0]}`;
  if (grant.tables) return `tables:${grant.tables[0]}`;
  if (grant.types) return `types:${grant.types[0]}`;

  return '';
};

const mockQueryResult = (
  data: Partial<Omit<IntrospectedStructure, 'defaultPrivileges' | 'grants'>> & {
    defaultPrivileges?: RawDbStructure.DefaultPrivilege[];
    grants?: RawDbStructure.Grant[];
    policies?: RawDbStructure.RlsPolicy[];
  },
) => {
  jest.spyOn(adapter, 'query').mockResolvedValueOnce({
    rowCount: 1,
    fields: [],
    rows: [
      {
        version: 'PostgreSQL 17.2',
      },
    ],
  });

  jest.spyOn(adapter, 'query').mockResolvedValueOnce({
    rowCount: 1,
    fields: [],
    rows: [
      {
        tables: [],
        views: [],
        materializedViews: [],
        domains: [],
        roles: [],
        indexes: [],
        ...data,
      },
    ],
  });
};

describe('dbStructure', () => {
  beforeEach(jest.clearAllMocks);
  afterAll(() => adapter.close());

  it('should ignore indexes with `exclude` and collect them into `excludes` instead', async () => {
    mockQueryResult({
      indexes: [
        dbStructureMockFactory.index({
          exclude: [],
        } as never),
      ],
    });

    const { indexes, excludes } = await introspectDbSchema(adapter);

    expect(indexes).toEqual([]);
    expect(excludes.length).toBeGreaterThan(0);
  });

  describe('searchIndex', () => {
    it('should detect tsVector index', async () => {
      mockQueryResult({
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                expression:
                  "to_tsvector('english'::regconfig, ((((title || ' '::text) || \"user\") || ' '::text) || body))",
              },
            ],
          }),
        ],
      });

      const {
        indexes: [index],
      } = await introspectDbSchema(adapter);

      expect(index).toEqual(
        dbStructureMockFactory.index({
          columns: [
            {
              column: 'title',
            },
            {
              column: 'user',
            },
            {
              column: 'body',
            },
          ],
          language: 'english',
          tsVector: true,
        }),
      );
    });

    it('should detect tsVector index with weights', async () => {
      mockQueryResult({
        indexes: [
          dbStructureMockFactory.index({
            columns: [
              {
                expression:
                  "(((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::\"char\") || to_tsvector('english'::regconfig, COALESCE(\"user\", ''::text))) || setweight(to_tsvector('english'::regconfig, COALESCE(body, ''::text)), 'C'::\"char\")))",
              },
            ],
          }),
        ],
      });

      const {
        indexes: [index],
      } = await introspectDbSchema(adapter);

      expect(index).toEqual(
        dbStructureMockFactory.index({
          columns: [
            {
              column: 'title',
              weight: 'A',
            },
            {
              column: 'user',
            },
            {
              column: 'body',
              weight: 'C',
            },
          ],
          tsVector: true,
          language: 'english',
        }),
      );
    });
  });

  it('should detect tsVector index with language column', async () => {
    mockQueryResult({
      indexes: [
        dbStructureMockFactory.index({
          columns: [
            {
              expression: 'to_tsvector(lang, title)',
            },
          ],
        }),
      ],
    });

    const {
      indexes: [index],
    } = await introspectDbSchema(adapter);

    expect(index).toEqual(
      dbStructureMockFactory.index({
        columns: [
          {
            column: 'title',
          },
        ],
        tsVector: true,
        languageColumn: 'lang',
      }),
    );
  });

  it('should preserve active unique constraint deferrability on indexes', async () => {
    mockQueryResult({
      indexes: [
        dbStructureMockFactory.index({
          name: 'immediate_key',
          unique: true,
          deferrable: 'immediate',
        }),
        dbStructureMockFactory.index({
          name: 'deferred_key',
          unique: true,
          deferrable: 'deferred',
        }),
        dbStructureMockFactory.index({
          name: 'not_deferrable_key',
          unique: true,
          deferrable: false,
        }),
        dbStructureMockFactory.index({
          name: 'plain_idx',
          unique: false,
        }),
      ],
    });

    const { indexes } = await introspectDbSchema(adapter);

    expect(indexes).toEqual([
      dbStructureMockFactory.index({
        name: 'immediate_key',
        unique: true,
        deferrable: 'immediate',
      }),
      dbStructureMockFactory.index({
        name: 'deferred_key',
        unique: true,
        deferrable: 'deferred',
      }),
      dbStructureMockFactory.index({
        name: 'not_deferrable_key',
        unique: true,
      }),
      dbStructureMockFactory.index({
        name: 'plain_idx',
        unique: false,
      }),
    ]);
  });

  it('should query unique constraint deferrability for indexes', async () => {
    mockQueryResult({});

    await introspectDbSchema(adapter);

    const sql = asMock(adapter.query).mock.calls[1][0];
    expect(sql).toContain(`contype = 'u'`);
    expect(sql).toContain('c.condeferrable');
    expect(sql).toContain('c.condeferred');
  });

  it('should not load views by default', async () => {
    mockQueryResult({
      views: undefined,
      materializedViews: undefined,
    });

    const result = await introspectDbSchema(adapter);

    expect(result.views).toBeUndefined();
    expect(result.materializedViews).toBeUndefined();

    const sql = asMock(adapter.query).mock.calls[1][0];
    expect(sql).not.toContain(`AS "views"`);
    expect(sql).not.toContain(`AS "materializedViews"`);
    expect(sql).not.toContain(`c.relkind = 'v'`);
    expect(sql).not.toContain(`c.relkind = 'm'`);
  });

  it('should load regular and materialized views when enabled', async () => {
    const view = dbStructureMockFactory.view();
    const materializedView = dbStructureMockFactory.materializedView({
      isPopulated: false,
      tablespace: 'fast_space',
    });
    mockQueryResult({
      views: [view],
      materializedViews: [materializedView],
    });

    const { views, materializedViews } = await introspectDbSchema(adapter, {
      loadViews: true,
    });

    expect(views).toEqual([view]);
    expect(materializedViews).toEqual([materializedView]);

    const sql = asMock(adapter.query).mock.calls[1][0];
    expect(sql).toContain(`c.relkind = 'v'`);
    expect(sql).toContain(`c.relkind = 'm'`);
    expect(sql).toContain(`c.relpersistence != 't'`);
  });

  describe('roles', () => {
    it('should parse roles, should use default roles WHERE', async () => {
      const now = new Date();
      const role = dbStructureMockFactory.role({
        validUntil: now.toISOString() as never,
        config: [
          'statement_timeout=60s',
          `search_path="""someSchema"", public"`,
        ] as never,
      });
      mockQueryResult({
        roles: [role],
      });

      const { roles } = await introspectDbSchema(adapter, { roles: {} });

      expect(roles).toEqual([
        {
          ...role,
          validUntil: now,
          config: {
            statement_timeout: '60s',
            search_path: `"someSchema", public`,
          },
        },
      ]);

      const sql = asMock(adapter.query).mock.calls[1][0];
      expect(sql.includes(`rolname != 'postgres' AND rolname !~ '^pg_'`)).toBe(
        true,
      );
    });
  });

  describe('defaultPrivileges', () => {
    it('should load defaultPrivileges when loadDefaultPrivileges is true', async () => {
      mockQueryResult({
        defaultPrivileges: [defaultPrivilege() as never],
      });

      const { defaultPrivileges } = await introspectDbSchema(adapter, {
        loadDefaultPrivileges: true,
      });

      expect(defaultPrivileges).toEqual([
        {
          owner: 'postgres',
          grantee: 'app_user',
          schema: 'public',
          objectConfigs: [
            {
              object: 'TABLES',
              privilegeConfigs: [
                { privilege: 'SELECT', isGrantable: false },
                { privilege: 'INSERT', isGrantable: true },
              ],
            },
          ],
        },
      ]);
    });

    it('should group multiple object types by grantor, grantee, and schema, including SCHEMAS and LARGE OBJECTS', async () => {
      mockQueryResult({
        defaultPrivileges: [
          defaultPrivilege({
            object: 'relation',
            privileges: ['SELECT'],
            isGrantables: [false],
          }) as never,
          defaultPrivilege({
            object: 'sequence',
            privileges: ['USAGE'],
            isGrantables: [true],
          }) as never,
          defaultPrivilege({
            object: 'function',
            privileges: ['EXECUTE'],
            isGrantables: [false],
          }) as never,
          defaultPrivilege({
            object: 'type',
            privileges: ['USAGE'],
            isGrantables: [true],
          }) as never,
          defaultPrivilege({
            object: 'schema',
            privileges: ['USAGE'],
            isGrantables: [false],
          }) as never,
          defaultPrivilege({
            object: 'large_object',
            privileges: ['SELECT'],
            isGrantables: [true],
          }) as never,
        ],
      });

      const { defaultPrivileges } = await introspectDbSchema(adapter, {
        loadDefaultPrivileges: true,
      });

      expect(defaultPrivileges?.length).toBe(1);
      expect(defaultPrivileges?.[0].objectConfigs).toEqual([
        {
          object: 'TABLES',
          privilegeConfigs: [{ privilege: 'SELECT', isGrantable: false }],
        },
        {
          object: 'SEQUENCES',
          privilegeConfigs: [{ privilege: 'USAGE', isGrantable: true }],
        },
        {
          object: 'FUNCTIONS',
          privilegeConfigs: [{ privilege: 'EXECUTE', isGrantable: false }],
        },
        {
          object: 'TYPES',
          privilegeConfigs: [{ privilege: 'USAGE', isGrantable: true }],
        },
        {
          object: 'SCHEMAS',
          privilegeConfigs: [{ privilege: 'USAGE', isGrantable: false }],
        },
        {
          object: 'LARGE_OBJECTS',
          privilegeConfigs: [{ privilege: 'SELECT', isGrantable: true }],
        },
      ]);
    });

    it('should create separate entries for different grantor, grantee, or schema (including global)', async () => {
      mockQueryResult({
        defaultPrivileges: [
          defaultPrivilege({
            grantor: 'postgres',
            grantee: 'user1',
            schema: 'public',
          }) as never,
          defaultPrivilege({
            grantor: 'postgres',
            grantee: 'user2',
            schema: 'public',
          }) as never,
          defaultPrivilege({
            grantor: 'postgres',
            grantee: 'user1',
            schema: 'private',
          }) as never,
          defaultPrivilege({
            grantor: 'postgres',
            grantee: 'user1',
            schema: undefined,
          }) as never,
        ],
      });

      const { defaultPrivileges } = await introspectDbSchema(adapter, {
        loadDefaultPrivileges: true,
      });

      expect(defaultPrivileges).toEqual([
        {
          owner: 'postgres',
          grantee: 'user1',
          schema: 'public',
          objectConfigs: [
            {
              object: 'TABLES',
              privilegeConfigs: [
                { privilege: 'SELECT', isGrantable: false },
                { privilege: 'INSERT', isGrantable: true },
              ],
            },
          ],
        },
        {
          owner: 'postgres',
          grantee: 'user2',
          schema: 'public',
          objectConfigs: [
            {
              object: 'TABLES',
              privilegeConfigs: [
                { privilege: 'SELECT', isGrantable: false },
                { privilege: 'INSERT', isGrantable: true },
              ],
            },
          ],
        },
        {
          owner: 'postgres',
          grantee: 'user1',
          schema: 'private',
          objectConfigs: [
            {
              object: 'TABLES',
              privilegeConfigs: [
                { privilege: 'SELECT', isGrantable: false },
                { privilege: 'INSERT', isGrantable: true },
              ],
            },
          ],
        },
        {
          owner: 'postgres',
          grantee: 'user1',
          schema: undefined,
          objectConfigs: [
            {
              object: 'TABLES',
              privilegeConfigs: [
                { privilege: 'SELECT', isGrantable: false },
                { privilege: 'INSERT', isGrantable: true },
              ],
            },
          ],
        },
      ]);
    });

    it('should not load defaultPrivileges when loadDefaultPrivileges is not set', async () => {
      mockQueryResult({});

      const { defaultPrivileges } = await introspectDbSchema(adapter, {});

      expect(defaultPrivileges).toBeUndefined();
    });
  });

  describe('grants', () => {
    it('should load direct grants for concrete supported targets when loadGrants is true', async () => {
      mockQueryResult({
        grants: [
          grant({
            grantor: 'postgres',
            grantee: 'introspect_grants_user',
            schema: undefined,
            name: 'orchid_orm_test',
            target: 'databases',
            privileges: ['CONNECT', 'TEMPORARY'],
            isGrantables: [false, true],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'email',
            target: 'domains',
            privileges: ['USAGE'],
            isGrantables: [false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'answer',
            target: 'routines',
            privileges: ['EXECUTE'],
            isGrantables: [true],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: undefined,
            name: 'introspect_grants',
            target: 'schemas',
            privileges: ['CREATE', 'USAGE'],
            isGrantables: [true, false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'item_id_seq',
            target: 'sequences',
            privileges: ['SELECT', 'USAGE'],
            isGrantables: [true, false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'item',
            target: 'tables',
            privileges: ['INSERT', 'SELECT', 'UPDATE'],
            isGrantables: [true, false, false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'schema_wide_item',
            target: 'tables',
            privileges: ['UPDATE'],
            isGrantables: [false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'introspect_grants_user',
            schema: 'introspect_grants',
            name: 'mood',
            target: 'types',
            privileges: ['USAGE'],
            isGrantables: [false],
          }),
        ],
      });

      const { grants } = await introspectDbSchema(adapter, {
        loadGrants: true,
      });

      expect(
        sortGrants(
          (grants ?? []).filter(
            (grant) => grant.to[0] === 'introspect_grants_user',
          ),
        ),
      ).toEqual([
        {
          to: ['introspect_grants_user'],
          grantedBy: 'postgres',
          databases: ['orchid_orm_test'],
          privileges: ['CONNECT'],
          grantablePrivileges: ['TEMPORARY'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          domains: ['introspect_grants.email'],
          privileges: ['USAGE'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          routines: ['introspect_grants.answer'],
          grantablePrivileges: ['EXECUTE'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          schemas: ['introspect_grants'],
          privileges: ['USAGE'],
          grantablePrivileges: ['CREATE'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          sequences: ['introspect_grants.item_id_seq'],
          privileges: ['USAGE'],
          grantablePrivileges: ['SELECT'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          tables: ['introspect_grants.item'],
          privileges: ['SELECT', 'UPDATE'],
          grantablePrivileges: ['INSERT'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          tables: ['introspect_grants.schema_wide_item'],
          privileges: ['UPDATE'],
        },
        {
          to: ['introspect_grants_user'],
          grantedBy: 'introspect_grants_grantor',
          types: ['introspect_grants.mood'],
          privileges: ['USAGE'],
        },
      ]);
    });

    it('should load supported PUBLIC default grants from null ACLs', async () => {
      mockQueryResult({
        grants: [
          grant({
            grantee: 'PUBLIC',
            schema: undefined,
            name: 'orchid_orm_test',
            target: 'databases',
            privileges: ['CONNECT', 'TEMPORARY'],
            isGrantables: [false, false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'PUBLIC',
            schema: 'introspect_grants',
            name: 'default_email',
            target: 'domains',
            privileges: ['USAGE'],
            isGrantables: [false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'PUBLIC',
            schema: 'introspect_grants',
            name: 'default_answer',
            target: 'routines',
            privileges: ['EXECUTE'],
            isGrantables: [false],
          }),
          grant({
            grantor: 'introspect_grants_grantor',
            grantee: 'PUBLIC',
            schema: 'introspect_grants',
            name: 'default_mood',
            target: 'types',
            privileges: ['USAGE'],
            isGrantables: [false],
          }),
        ],
      });

      const { grants } = await introspectDbSchema(adapter, {
        loadGrants: true,
      });

      expect(
        sortGrants(
          (grants ?? []).filter((grant) => {
            const target = getGrantTarget(grant);

            return (
              grant.to[0] === 'PUBLIC' &&
              (target === 'databases:orchid_orm_test' ||
                target === 'domains:introspect_grants.default_email' ||
                target === 'routines:introspect_grants.default_answer' ||
                target === 'types:introspect_grants.default_mood')
            );
          }),
        ),
      ).toEqual([
        {
          to: ['PUBLIC'],
          grantedBy: 'postgres',
          databases: ['orchid_orm_test'],
          privileges: ['CONNECT', 'TEMPORARY'],
        },
        {
          to: ['PUBLIC'],
          grantedBy: 'introspect_grants_grantor',
          domains: ['introspect_grants.default_email'],
          privileges: ['USAGE'],
        },
        {
          to: ['PUBLIC'],
          grantedBy: 'introspect_grants_grantor',
          routines: ['introspect_grants.default_answer'],
          privileges: ['EXECUTE'],
        },
        {
          to: ['PUBLIC'],
          grantedBy: 'introspect_grants_grantor',
          types: ['introspect_grants.default_mood'],
          privileges: ['USAGE'],
        },
      ]);
    });

    it('should not load schema-wide grant declarations as stored ACL grants', async () => {
      mockQueryResult({
        grants: [
          grant({
            target: 'tables',
            name: 'schema_wide_item',
            privileges: ['UPDATE'],
            isGrantables: [false],
          }),
        ],
      });

      const { grants } = await introspectDbSchema(adapter, {
        loadGrants: true,
      });

      expect(
        (grants ?? []).some(
          (grant) =>
            !!grant.allTablesIn ||
            !!grant.allSequencesIn ||
            !!grant.allRoutinesIn,
        ),
      ).toBe(false);
    });

    it('should not load grants when loadGrants is not set', async () => {
      mockQueryResult({});

      const { grants } = await introspectDbSchema(adapter, {});

      expect(grants).toBeUndefined();
    });
  });

  describe('rls', () => {
    it('should load table rls flags when rls is true', async () => {
      const table = dbStructureMockFactory.table({
        rls: {
          enable: true,
          force: false,
        },
      });
      mockQueryResult({
        tables: [table],
      });

      const { tables } = await introspectDbSchema(adapter, { rls: true });

      expect(tables).toEqual([table]);

      const sql = asMock(adapter.query).mock.calls[1][0];
      expect(sql.includes('nr.nspname = n.nspname')).toBe(true);
    });

    it('should load table rls policies when rls is true', async () => {
      mockQueryResult({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            rls: {
              enable: true,
              force: false,
            },
          }),
        ],
        policies: [
          rlsPolicy(),
          rlsPolicy({
            name: 'table_insert_policy',
            mode: 'RESTRICTIVE',
            command: 'UPDATE',
            roles: ['public', 'app_admin'],
            using: "(owner_id = current_setting('app.user_id', true)::uuid)",
            withCheck:
              "(tenant_id = current_setting('app.tenant_id', true)::uuid)",
          }),
          rlsPolicy({
            tableName: 'other_table',
            name: 'other_table_select_policy',
          }),
        ],
      });

      const { tables } = await introspectDbSchema(adapter, { rls: true });

      expect(tables).toEqual([
        dbStructureMockFactory.table({
          name: 'table',
          rls: {
            enable: true,
            force: false,
            policies: [
              {
                schemaName: 'public',
                tableName: 'table',
                name: 'table_select_policy',
                mode: 'PERMISSIVE',
                command: 'SELECT',
                roles: ['app_user'],
                using:
                  "(tenant_id = current_setting('app.tenant_id', true)::uuid)",
              },
              {
                schemaName: 'public',
                tableName: 'table',
                name: 'table_insert_policy',
                mode: 'RESTRICTIVE',
                command: 'UPDATE',
                roles: ['public', 'app_admin'],
                using:
                  "(owner_id = current_setting('app.user_id', true)::uuid)",
                withCheck:
                  "(tenant_id = current_setting('app.tenant_id', true)::uuid)",
              },
            ],
          },
        }),
      ]);

      const sql = asMock(adapter.query).mock.calls[1][0];
      expect(sql.includes('FROM pg_policy p')).toBe(true);
    });

    it('should not load table rls flags when rls is not set', async () => {
      mockQueryResult({});

      const { tables } = await introspectDbSchema(adapter);

      expect(tables).toEqual([]);

      const sql = asMock(adapter.query).mock.calls[1][0];
      expect(sql.includes('FROM pg_policy p')).toBe(false);
    });
  });
});
