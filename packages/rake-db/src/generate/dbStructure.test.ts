import { Adapter } from 'pqb';
import { introspectDbSchema } from './dbStructure';
import { dbStructureMockFactory } from './dbStructure.mockFactory';
import { StructureToAstTableData } from './structureToAst';

const adapter = new Adapter({
  databaseURL: process.env.PG_URL,
});

const mockQueryResult = (data: Partial<StructureToAstTableData>) => {
  jest.spyOn(adapter, 'query').mockImplementation(() =>
    Promise.resolve({
      rowCount: 1,
      fields: [],
      rows: [
        {
          tables: [],
          domains: [],
          ...data,
        },
      ],
    }),
  );
};

describe('dbStructure', () => {
  afterAll(() => adapter.close());

  it('should ignore indexes with `exclude`', async () => {
    mockQueryResult({
      indexes: [
        dbStructureMockFactory.index({
          exclude: [],
        }),
      ],
    });

    const { indexes } = await introspectDbSchema(adapter);

    expect(indexes).toEqual([]);
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
});
