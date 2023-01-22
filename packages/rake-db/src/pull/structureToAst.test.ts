import { DbStructure } from './dbStructure';
import { Adapter, IntegerColumn, TextColumn } from 'pqb';
import { structureToAst } from './structureToAst';
import { RakeDbAst } from '../ast';

const adapter = new Adapter({ databaseURL: 'file:path' });
const query = jest.fn().mockImplementation(() => ({ rows: [] }));
adapter.query = query;
adapter.arrays = query;

const tableColumn: DbStructure.Column = {
  schemaName: 'public',
  tableName: 'table',
  name: 'column',
  type: 'int4',
  default: '123',
  isNullable: false,
};

const tableColumns = [
  { ...tableColumn, name: 'id' },
  { ...tableColumn, name: 'name', type: 'text' },
];

const otherTableColumn = { ...tableColumn, tableName: 'otherTable' };

const table = { schemaName: 'public', name: 'table' };

const columns = [...tableColumns, otherTableColumn];

const primaryKey: DbStructure.Constraint = {
  schemaName: 'public',
  tableName: 'table',
  name: 'pkey',
  type: 'PRIMARY KEY',
  columnNames: ['id'],
};

const index: DbStructure.Index = {
  schemaName: 'public',
  tableName: 'table',
  columnNames: ['name'],
  name: 'index',
  isUnique: false,
  isPrimary: false,
};

const foreignKey: DbStructure.ForeignKey = {
  schemaName: 'public',
  tableName: 'table',
  foreignTableSchemaName: 'public',
  foreignTableName: 'otherTable',
  name: 'fkey',
  columnNames: ['otherId'],
  foreignColumnNames: ['id'],
};

const extension: DbStructure.Extension = {
  schemaName: 'public',
  name: 'name',
  version: '123',
};

describe('structureToAst', () => {
  it('should add schema except public', async () => {
    const db = new DbStructure(adapter);
    db.getSchemas = async () => ['public', 'one', 'two'];
    const ast = await structureToAst(db);
    expect(ast).toEqual([
      {
        type: 'schema',
        action: 'create',
        name: 'one',
      },
      {
        type: 'schema',
        action: 'create',
        name: 'two',
      },
    ]);
  });

  describe('table', () => {
    it('should add table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      const ast = await structureToAst(db);
      expect(ast).toEqual([
        {
          type: 'table',
          action: 'create',
          name: 'table',
          shape: {},
          noPrimaryKey: 'ignore',
          indexes: [],
          foreignKeys: [],
        },
      ]);
    });

    it('should add table with schema', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'custom', name: 'table' }];
      const ast = await structureToAst(db);
      expect(ast).toEqual([
        {
          type: 'table',
          action: 'create',
          schema: 'custom',
          name: 'table',
          shape: {},
          noPrimaryKey: 'ignore',
          indexes: [],
          foreignKeys: [],
        },
      ]);
    });

    it('should add columns', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      db.getColumns = async () => columns;

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(Object.keys(ast.shape).length).toBe(tableColumns.length);
      expect(ast.noPrimaryKey).toBe('ignore');
      expect(ast.shape.id).toBeInstanceOf(IntegerColumn);
      expect(ast.shape.name).toBeInstanceOf(TextColumn);
    });

    it('should set primaryKey to column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      db.getColumns = async () => columns;
      db.getConstraints = async () => [primaryKey];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.isPrimaryKey).toBe(true);
      expect(ast.primaryKey).toBe(undefined);
    });

    it('should add composite primary key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      db.getColumns = async () => columns;
      db.getConstraints = async () => [
        { ...primaryKey, columnNames: ['id', 'name'] },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.isPrimaryKey).toBe(false);
      expect(ast.primaryKey).toEqual({
        columns: ['id', 'name'],
        options: { name: 'pkey' },
      });
    });

    it('should ignore primary key name if it is standard', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      db.getColumns = async () => columns;
      db.getConstraints = async () => [
        { ...primaryKey, columnNames: ['id', 'name'], name: 'table_pkey' },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.isPrimaryKey).toBe(false);
      expect(ast.primaryKey).toEqual({
        columns: ['id', 'name'],
      });
    });

    it('should ignore primary key indexes', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [{ schemaName: 'public', name: 'table' }];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [{ ...index, isPrimary: true }];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.index).toBe(undefined);
      expect(ast.indexes).toHaveLength(0);
    });

    it('should add index to column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [index];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.index).toEqual({
        name: 'index',
        unique: false,
      });
      expect(ast.indexes).toHaveLength(0);
    });

    it('should add composite indexes to table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [
        { ...index, columnNames: ['id', 'name'] },
        { ...index, columnNames: ['id', 'name'], isUnique: true },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.index).toBe(undefined);
      expect(ast.indexes).toEqual([
        {
          columns: [{ column: 'id' }, { column: 'name' }],
          options: { name: 'index', unique: false },
        },
        {
          columns: [{ column: 'id' }, { column: 'name' }],
          options: { name: 'index', unique: true },
        },
      ]);
    });

    it('should add foreign key to the column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [
        ...columns,
        { ...tableColumn, name: 'otherId' },
      ];
      db.getForeignKeys = async () => [foreignKey];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.shape.otherId.data.foreignKey).toEqual({
        columns: ['id'],
        name: 'fkey',
        table: 'otherTable',
      });
      expect(ast.foreignKeys).toHaveLength(0);
    });

    it('should add composite foreign key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [
        ...columns,
        { ...tableColumn, name: 'otherId' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          columnNames: ['name', 'otherId'],
          foreignColumnNames: ['name', 'id'],
        },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.shape.otherId.data.foreignKey).toBe(undefined);
      expect(ast.foreignKeys).toEqual([
        {
          columns: ['name', 'otherId'],
          fnOrTable: 'otherTable',
          foreignColumns: ['name', 'id'],
          options: {
            name: 'fkey',
          },
        },
      ]);
    });
  });

  describe('extension', () => {
    it('should add extension', async () => {
      const db = new DbStructure(adapter);
      db.getExtensions = async () => [{ ...extension, schemaName: 'custom' }];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Extension];

      expect(ast).toEqual({
        type: 'extension',
        action: 'create',
        name: 'name',
        schema: 'custom',
        version: '123',
      });
    });

    it('should ignore schema if it is `public`', async () => {
      const db = new DbStructure(adapter);
      db.getExtensions = async () => [extension];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Extension];

      expect(ast).toEqual({
        type: 'extension',
        action: 'create',
        name: 'name',
        version: '123',
      });
    });
  });
});
