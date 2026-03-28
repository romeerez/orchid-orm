import { introspectDbSchema, IntrospectedStructure } from './db-structure';
import { dbStructureMockFactory } from './db-structure.mockFactory';
import { asMock, TestAdapter } from 'test-utils';

interface RawDefaultPrivilege {
  grantor: string;
  grantee: string;
  schema?: string;
  object:
    | 'relation'
    | 'sequence'
    | 'function'
    | 'type'
    | 'schema'
    | 'large_object';
  privileges: string[];
  isGrantables: boolean[];
}

const defaultPrivilege = (
  data: Partial<RawDefaultPrivilege> = {},
): RawDefaultPrivilege => ({
  grantor: 'postgres',
  grantee: 'app_user',
  schema: 'public',
  object: 'relation',
  privileges: ['SELECT', 'INSERT'],
  isGrantables: [false, true],
  ...data,
});

const adapter = new TestAdapter({
  databaseURL: process.env.PG_URL,
});

const mockQueryResult = (data: Partial<IntrospectedStructure>) => {
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
});
