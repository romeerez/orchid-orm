import { DbStructure } from './dbStructure';
import {
  Adapter,
  BigSerialColumn,
  DecimalColumn,
  IntegerColumn,
  isRaw,
  RawExpression,
  SerialColumn,
  SmallSerialColumn,
  TextColumn,
  TimestampColumn,
  VarCharColumn,
} from 'pqb';
import { structureToAst } from './structureToAst';
import { RakeDbAst } from '../ast';
import { getIndexName } from '../migration/migrationUtils';

const adapter = new Adapter({ databaseURL: 'file:path' });
const query = jest.fn().mockImplementation(() => ({ rows: [] }));
adapter.query = query;
adapter.arrays = query;

const intColumn: DbStructure.Column = {
  schemaName: 'public',
  tableName: 'table',
  name: 'column',
  type: 'int4',
  default: '123',
  isNullable: false,
};

const varCharColumn: DbStructure.Column = {
  ...intColumn,
  name: 'varchar',
  type: 'character varying',
  collation: 'en_US',
  maxChars: 10,
};

const decimalColumn: DbStructure.Column = {
  ...intColumn,
  name: 'decimal',
  type: 'decimal',
  numericPrecision: 10,
  numericScale: 2,
};

const timestampColumn: DbStructure.Column = {
  ...intColumn,
  name: 'timestamp',
  type: 'timestamp',
  dateTimePrecision: 10,
};

const tableColumns = [
  { ...intColumn, name: 'id' },
  { ...intColumn, name: 'name', type: 'text' },
];

const otherTableColumn = { ...intColumn, tableName: 'otherTable' };

const table = { schemaName: 'public', name: 'table' };

const columns = [...tableColumns, otherTableColumn];

const primaryKey: DbStructure.PrimaryKey = {
  schemaName: 'public',
  tableName: 'table',
  name: 'pkey',
  columnNames: ['id'],
};

const index: DbStructure.Index = {
  schemaName: 'public',
  tableName: 'table',
  name: 'index',
  using: 'btree',
  isUnique: false,
  columns: [{ column: 'name' }],
};

const foreignKey: DbStructure.ForeignKey = {
  schemaName: 'public',
  tableName: 'table',
  foreignTableSchemaName: 'public',
  foreignTableName: 'otherTable',
  name: 'fkey',
  columnNames: ['otherId'],
  foreignColumnNames: ['id'],
  match: 'f',
  onUpdate: 'c',
  onDelete: 'c',
};

const extension: DbStructure.Extension = {
  schemaName: 'public',
  name: 'name',
  version: '123',
};

const enumType: DbStructure.Enum = {
  schemaName: 'public',
  name: 'mood',
  values: ['sad', 'ok', 'happy'],
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
      db.getTables = async () => [
        { schemaName: 'public', name: 'table', comment: 'comment' },
      ];

      const ast = await structureToAst(db);

      expect(ast).toEqual([
        {
          type: 'table',
          action: 'create',
          name: 'table',
          comment: 'comment',
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

    it('should ignore schemaMigrations table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { schemaName: 'public', name: 'schemaMigrations' },
      ];

      const ast = await structureToAst(db);

      expect(ast).toEqual([]);
    });

    it('should add columns', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(Object.keys(ast.shape).length).toBe(tableColumns.length);
      expect(ast.noPrimaryKey).toBe('ignore');
      expect(ast.shape.id).toBeInstanceOf(IntegerColumn);
      expect(ast.shape.name).toBeInstanceOf(TextColumn);
    });

    it('should wrap column default into raw', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [{ ...timestampColumn, default: 'now()' }];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      const { default: def } = ast.shape.timestamp.data;
      expect(def && typeof def === 'object' && isRaw(def)).toBe(true);
      expect((def as RawExpression).__raw).toBe('now()');
    });

    describe('serial column', () => {
      it('should add serial column based on various default values', async () => {
        const db = new DbStructure(adapter);
        db.getTables = async () => [{ schemaName: 'schema', name: 'table' }];

        const defaults = [
          `nextval('table_id_seq'::regclass)`,
          `nextval('"table_id_seq"'::regclass)`,
          `nextval('schema.table_id_seq'::regclass)`,
          `nextval('schema."table_id_seq"'::regclass)`,
          `nextval('"schema".table_id_seq'::regclass)`,
          `nextval('"schema"."table_id_seq"'::regclass)`,
        ];

        for (const def of defaults) {
          db.getColumns = async () => [
            {
              ...intColumn,
              name: 'id',
              schemaName: 'schema',
              tableName: 'table',
              default: def,
            },
          ];

          const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

          expect(ast.shape.id).toBeInstanceOf(SerialColumn);
          expect(ast.shape.id.data.default).toBe(undefined);
        }
      });

      it('should support smallserial, serial, and bigserial', async () => {
        const db = new DbStructure(adapter);
        db.getTables = async () => [{ schemaName: 'schema', name: 'table' }];

        const types = [
          ['int2', SmallSerialColumn],
          ['int4', SerialColumn],
          ['int8', BigSerialColumn],
        ] as const;

        for (const [type, Column] of types) {
          db.getColumns = async () => [
            {
              ...intColumn,
              type,
              name: 'id',
              schemaName: 'schema',
              tableName: 'table',
              default: `nextval('table_id_seq'::regclass)`,
            },
          ];

          const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

          expect(ast.shape.id).toBeInstanceOf(Column);
          expect(ast.shape.id.data.default).toBe(undefined);
        }
      });
    });

    it('should set maxChars to char column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [varCharColumn];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      const column = ast.shape[varCharColumn.name];
      expect(column).toBeInstanceOf(VarCharColumn);
      expect(column.data.maxChars).toBe(varCharColumn.maxChars);
    });

    it('should set numericPrecision and numericScale to decimal column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [decimalColumn];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      const column = ast.shape[decimalColumn.name];
      expect(column).toBeInstanceOf(DecimalColumn);
      expect(column.data.numericPrecision).toBe(decimalColumn.numericPrecision);
      expect(column.data.numericScale).toBe(decimalColumn.numericScale);
    });

    it('should set dateTimePrecision to timestamp column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [timestampColumn];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      const column = ast.shape[timestampColumn.name];
      expect(column).toBeInstanceOf(TimestampColumn);
      expect(column.data.dateTimePrecision).toBe(
        timestampColumn.dateTimePrecision,
      );
    });

    it('should set primaryKey to column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getPrimaryKeys = async () => [primaryKey];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.isPrimaryKey).toBe(true);
      expect(ast.primaryKey).toBe(undefined);
    });

    it('should add composite primary key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getPrimaryKeys = async () => [
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
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getPrimaryKeys = async () => [
        { ...primaryKey, columnNames: ['id', 'name'], name: 'table_pkey' },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.isPrimaryKey).toBe(false);
      expect(ast.primaryKey).toEqual({
        columns: ['id', 'name'],
      });
    });

    it('should add index to column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [index];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toEqual([
        {
          name: 'index',
          unique: false,
        },
      ]);
      expect(ast.indexes).toHaveLength(0);
    });

    it('should ignore standard index name', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [
        { ...index, name: getIndexName(table.name, index.columns) },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toEqual([
        {
          unique: false,
        },
      ]);
      expect(ast.indexes).toHaveLength(0);
    });

    it('should set index options to column index', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [
        {
          ...index,
          using: 'gist',
          isUnique: true,
          columns: [
            {
              column: 'name',
              collate: 'en_US',
              opclass: 'varchar_ops',
              order: 'DESC',
            },
          ],
          include: ['id'],
          with: 'fillfactor=80',
          tablespace: 'tablespace',
          where: 'condition',
        },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toEqual([
        {
          name: 'index',
          using: 'gist',
          unique: true,
          collate: 'en_US',
          opclass: 'varchar_ops',
          order: 'DESC',
          include: ['id'],
          with: 'fillfactor=80',
          tablespace: 'tablespace',
          where: 'condition',
        },
      ]);
      expect(ast.indexes).toHaveLength(0);
    });

    it('should add composite indexes to the table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [
        { ...index, columns: [{ column: 'id' }, { column: 'name' }] },
        {
          ...index,
          columns: [{ column: 'id' }, { column: 'name' }],
          isUnique: true,
        },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toBe(undefined);
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

    it('should ignore standard index name in composite index', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;

      const indexColumns = [{ column: 'id' }, { column: 'name' }];
      db.getIndexes = async () => [
        {
          ...index,
          columns: indexColumns,
          name: getIndexName(table.name, indexColumns),
        },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toBe(undefined);
      expect(ast.indexes).toEqual([
        {
          columns: indexColumns,
          options: { unique: false },
        },
      ]);
    });

    it('should add index with expression and options to the table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => columns;
      db.getIndexes = async () => [
        {
          ...index,
          using: 'gist',
          isUnique: true,
          columns: [
            {
              expression: 'lower(name)',
              collate: 'en_US',
              opclass: 'varchar_ops',
              order: 'DESC',
            },
          ],
          include: ['id'],
          with: 'fillfactor=80',
          tablespace: 'tablespace',
          where: 'condition',
        },
      ];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Table];
      expect(ast.shape.name.data.indexes).toBe(undefined);
      expect(ast.indexes).toEqual([
        {
          columns: [
            {
              expression: 'lower(name)',
              collate: 'en_US',
              opclass: 'varchar_ops',
              order: 'DESC',
            },
          ],
          options: {
            name: 'index',
            using: 'gist',
            unique: true,
            include: ['id'],
            with: 'fillfactor=80',
            tablespace: 'tablespace',
            where: 'condition',
          },
        },
      ]);
    });

    it('should add foreign key to the column', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
      ];
      db.getColumns = async () => [
        ...columns,
        { ...intColumn, name: 'otherId', tableName: 'table2' },
      ];
      db.getForeignKeys = async () => [
        { ...foreignKey, tableName: 'table2', foreignTableName: 'table1' },
      ];

      const [, ast] = (await structureToAst(db)) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toEqual([
        {
          columns: ['id'],
          name: 'fkey',
          table: 'table1',
          match: 'FULL',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      ]);
      expect(ast.foreignKeys).toHaveLength(0);
    });

    it('should ignore standard foreign key name', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
      ];
      db.getColumns = async () => [
        { ...intColumn, name: 'otherId', tableName: 'table2' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          name: `table2_otherId_fkey`,
          tableName: 'table2',
          foreignTableName: 'table1',
        },
      ];

      const [, ast] = (await structureToAst(db)) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toEqual([
        {
          columns: ['id'],
          table: 'table1',
          match: 'FULL',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      ]);
      expect(ast.foreignKeys).toHaveLength(0);
    });

    it('should add composite foreign key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
      ];
      db.getColumns = async () => [
        { ...intColumn, name: 'otherId', tableName: 'table2' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          tableName: 'table2',
          columnNames: ['name', 'otherId'],
          foreignTableName: 'table1',
          foreignColumnNames: ['name', 'id'],
        },
      ];

      const [, ast] = (await structureToAst(db)) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toBe(undefined);
      expect(ast.foreignKeys).toEqual([
        {
          columns: ['name', 'otherId'],
          fnOrTable: 'table1',
          foreignColumns: ['name', 'id'],
          options: {
            name: 'fkey',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        },
      ]);
    });

    it('should ignore standard foreign key name in a composite foreign key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
      ];
      db.getColumns = async () => [
        { ...intColumn, name: 'otherId', tableName: 'table2' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          tableName: 'table2',
          foreignTableName: 'table1',
          columnNames: ['name', 'otherId'],
          foreignColumnNames: ['name', 'id'],
          name: 'table2_name_otherId_fkey',
        },
      ];

      const [, ast] = (await structureToAst(db)) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toBe(undefined);
      expect(ast.foreignKeys).toEqual([
        {
          columns: ['name', 'otherId'],
          fnOrTable: 'table1',
          foreignColumns: ['name', 'id'],
          options: {
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        },
      ]);
    });

    it('should have referenced table before the table with foreign key', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'fkTable' },
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
        { ...table, name: 'otherTable' },
      ];
      db.getColumns = async () => [
        { ...intColumn, name: 'table1Id', tableName: 'fkTable' },
        { ...intColumn, name: 'table2Id', tableName: 'fkTable' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          tableName: 'fkTable',
          columnNames: ['table1Id'],
          foreignTableName: 'table1',
        },
        {
          ...foreignKey,
          tableName: 'fkTable',
          columnNames: ['table2Id'],
          foreignTableName: 'table2',
        },
      ];

      const [table1, table2, fkTable, otherTable] = (await structureToAst(
        db,
      )) as RakeDbAst.Table[];

      expect(table1.name).toBe('table1');
      expect(table2.name).toBe('table2');
      expect(fkTable.name).toBe('fkTable');
      expect(otherTable.name).toBe('otherTable');
    });

    it('should add foreign key to a same table', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [table];
      db.getColumns = async () => [intColumn];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          tableName: table.name,
          columnNames: [intColumn.name],
          foreignTableName: table.name,
        },
      ];

      const [ast] = (await structureToAst(db)) as RakeDbAst.Table[];

      expect(ast.name).toBe(table.name);
    });

    it('should add standalone foreign key when it is recursive', async () => {
      const db = new DbStructure(adapter);
      db.getTables = async () => [
        { ...table, name: 'table1' },
        { ...table, name: 'table2' },
      ];
      db.getColumns = async () => [
        { ...intColumn, tableName: 'table1' },
        { ...intColumn, tableName: 'table2' },
      ];
      db.getForeignKeys = async () => [
        {
          ...foreignKey,
          tableName: 'table1',
          columnNames: [intColumn.name],
          foreignTableName: 'table2',
        },
        {
          ...foreignKey,
          tableName: 'table2',
          columnNames: [intColumn.name],
          foreignTableName: 'table1',
        },
      ];

      const [table1, table2, fkey] = (await structureToAst(
        db,
      )) as RakeDbAst.Table[];

      expect(table1.name).toBe('table1');
      expect(table1.shape[intColumn.name].data.foreignKeys).toBe(undefined);
      expect(table2.name).toBe('table2');
      expect(table2.shape[intColumn.name].data.foreignKeys).toEqual([
        {
          table: 'table1',
          columns: ['id'],
          match: 'FULL',
          name: 'fkey',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      ]);

      expect(fkey).toEqual({
        type: 'foreignKey',
        action: 'create',
        tableName: 'table1',
        columns: ['column'],
        fnOrTable: 'table2',
        foreignColumns: ['id'],
        options: {
          match: 'FULL',
          name: 'fkey',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      });
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

  describe('enum', () => {
    it('should add enum', async () => {
      const db = new DbStructure(adapter);
      db.getEnums = async () => [{ ...enumType, schemaName: 'custom' }];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Enum];

      expect(ast).toEqual({
        type: 'enum',
        action: 'create',
        name: 'mood',
        schema: 'custom',
        values: enumType.values,
      });
    });

    it('should ignore schema if it is `public`', async () => {
      const db = new DbStructure(adapter);
      db.getEnums = async () => [enumType];

      const [ast] = (await structureToAst(db)) as [RakeDbAst.Enum];

      expect(ast).toEqual({
        type: 'enum',
        action: 'create',
        name: 'mood',
        values: enumType.values,
      });
    });
  });
});
