import { DbStructure } from './dbStructure';
import { Adapter } from 'pqb';

const adapter = new Adapter({
  databaseURL: 'file:path',
});
let rows: unknown[][] | Record<string, unknown>[] = [];
adapter.query = jest.fn().mockImplementation(() => ({ rows }));
adapter.arrays = jest.fn().mockImplementation(() => ({ rows }));
const db = new DbStructure(adapter);

describe('dbStructure', () => {
  describe('getSchemas', () => {
    it('should return schemas', async () => {
      rows = [['a'], ['b']];
      const result = await db.getSchemas();
      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('getTables', () => {
    it('should return tables', async () => {
      rows = [{ schemaName: 'schema', name: 'table', comment: 'comment' }];
      const result = await db.getTables();
      expect(result).toEqual(rows);
    });
  });

  describe('getViews', () => {
    it('should return views', async () => {
      rows = [{ schemaName: 'schema', name: 'view' }];
      const result = await db.getViews();
      expect(result).toEqual(rows);
    });
  });

  describe('getProcedures', () => {
    it('should return procedures', async () => {
      rows = [
        {
          schemaName: 'public',
          name: 'name',
          returnSet: true,
          returnType: 'int4',
          kind: 'f',
          isTrigger: false,
          types: ['int4', 'int4', 'int4'],
          argTypes: [23, 23, 23],
          argModes: ['i', 'i', 'o'],
          argNames: ['a', 'b', 'c'],
        },
      ];
      const result = await db.getProcedures();
      expect(result).toEqual(rows);
    });
  });

  describe('getColumns', () => {
    it('should return columns', async () => {
      rows = [
        {
          schemaName: 'public',
          tableName: 'table',
          name: 'name',
          type: 'int4',
          default: '123',
          isNullable: false,
          collation: 'en_US',
          compression: 'p',
          comment: 'column comment',
        },
      ];
      const result = await db.getColumns();
      expect(result).toEqual(rows);
    });
  });

  describe('getIndexes', () => {
    it('should return indexes', async () => {
      rows = [
        {
          schemaName: 'public',
          tableName: 'table',
          name: 'indexName',
          isUnique: true,
          columns: [{ column: 'column' }],
          include: null,
          with: null,
          tablespace: null,
          where: null,
        },
      ];
      const result = await db.getIndexes();
      expect(result).toEqual(rows);
    });
  });

  describe('getForeignKeys', () => {
    it('should return foreignKeys', async () => {
      rows = [
        {
          schemaName: 'public',
          tableName: 'table',
          foreignTableSchemaName: 'public',
          foreignTableName: 'foreignTable',
          name: 'name',
          columnNames: ['column'],
          foreignColumnNames: ['foreignColumn'],
          match: 's',
          onUpdate: 'a',
          onDelete: 'a',
        },
      ];
      const result = await db.getForeignKeys();
      expect(result).toEqual(rows);
    });
  });

  describe('getPrimaryKeys', () => {
    it('should return constraints', async () => {
      rows = [
        {
          schemaName: 'public',
          tableName: 'table',
          name: 'name',
          columnNames: ['id'],
        },
      ];
      const result = await db.getPrimaryKeys();
      expect(result).toEqual(rows);
    });
  });

  describe('getTriggers', () => {
    it('should return triggers', async () => {
      rows = [
        {
          schemaName: 'public',
          tableName: 'table',
          triggerSchema: 'public',
          name: 'name',
          events: ['UPDATE'],
          activation: 'BEFORE',
          condition: null,
          definition: 'EXECUTE FUNCTION name()',
        },
      ];
      const result = await db.getTriggers();
      expect(result).toEqual(rows);
    });
  });

  describe('getExtensions', () => {
    it('should return extensions', async () => {
      rows = [
        {
          schemaName: 'public',
          name: 'pg_trgm',
          version: '1.6',
        },
      ];
      const result = await db.getExtensions();
      expect(result).toEqual(rows);
    });
  });

  describe('getEnums', () => {
    it('should return enums', async () => {
      rows = [
        {
          schemaName: 'public',
          name: 'mood',
          values: ['sad', 'ok', 'happy'],
        },
      ];
      const result = await db.getEnums();
      expect(result).toEqual(rows);
    });
  });
});
