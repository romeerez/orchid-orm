import { introspectDbSchema } from './db-structure';
import { dbStructureMockFactory } from './db-structure.mockFactory';
import { StructureToAstTableData } from './structure-to-ast';
import { asMock, TestAdapter } from 'test-utils';

const adapter = new TestAdapter({
  databaseURL: process.env.PG_URL,
});

const mockQueryResult = (data: Partial<StructureToAstTableData>) => {
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
