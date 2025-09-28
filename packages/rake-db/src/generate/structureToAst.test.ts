import { introspectDbSchema } from './dbStructure';
import {
  ArrayColumn,
  BigSerialColumn,
  CustomTypeColumn,
  DecimalColumn,
  DomainColumn,
  EnumColumn,
  IntegerColumn,
  makeColumnsByType,
  raw,
  SerialColumn,
  SmallSerialColumn,
  TextColumn,
  TimestampTZColumn,
  VarCharColumn,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  RawSQL,
} from 'pqb';
import { structureToAst, StructureToAstCtx } from './structureToAst';
import { RakeDbAst } from '../ast';
import { getIndexName, getExcludeName } from '../migration/migration.utils';
import { isRawSQL, TemplateLiteralArgs } from 'orchid-core';
import { asMock, TestAdapter } from 'test-utils';
import { dbStructureMockFactory } from './dbStructure.mockFactory';
import { testConfig } from '../rake-db.test-utils';

jest.mock('./dbStructure');

const adapter = new TestAdapter({ databaseURL: 'file:path' });
const query = jest.fn().mockImplementation(() => ({ rows: [] }));
adapter.query = query;
adapter.arrays = query;

const ctx: StructureToAstCtx = {
  unsupportedTypes: {},
  snakeCase: false,
  currentSchema: 'custom',
  columnSchemaConfig: defaultSchemaConfig,
  columnsByType: makeColumnsByType(defaultSchemaConfig),
};

const structure = {
  schemas: [],
  tables: [],
  views: [],
  indexes: [],
  excludes: [],
  constraints: [],
  triggers: [],
  extensions: [],
  enums: [],
  domains: [],
  collations: [],
} as Awaited<ReturnType<typeof introspectDbSchema>>;

asMock(introspectDbSchema).mockResolvedValue(structure);

const config = testConfig;

describe('structureToAst', () => {
  beforeEach(() => {
    ctx.unsupportedTypes = {};
    ctx.snakeCase = false;

    for (const key in structure) {
      structure[key as keyof typeof structure].length = 0;
    }
  });

  it('should add schema except public', async () => {
    structure.schemas = ['public', 'one', 'two'];

    const ast = await structureToAst(ctx, adapter, config);
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
      structure.tables = [dbStructureMockFactory.table({ comment: 'comment' })];

      const ast = await structureToAst(ctx, adapter, config);

      expect(ast).toEqual([
        {
          type: 'table',
          action: 'create',
          schema: 'public',
          name: 'table',
          comment: 'comment',
          shape: {},
          noPrimaryKey: 'ignore',
          indexes: [],
          excludes: [],
          constraints: [],
        },
      ]);
    });

    it('should ignore current schema', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          schemaName: 'custom',
        }),
      ];

      const ast = await structureToAst(ctx, adapter, config);

      expect(ast).toEqual([
        {
          type: 'table',
          action: 'create',
          name: 'table',
          shape: {},
          noPrimaryKey: 'ignore',
          indexes: [],
          excludes: [],
          constraints: [],
        },
      ]);
    });

    it('should ignore schemaMigrations table', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          name: 'schemaMigrations',
        }),
      ];

      const ast = await structureToAst(ctx, adapter, config);

      expect(ast).toEqual([]);
    });

    it('should add columns', async () => {
      const [table] = (structure.tables = [
        dbStructureMockFactory.tableWithColumns(),
      ]);

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(Object.keys(ast.shape).length).toBe(table.columns.length);
      expect(ast.noPrimaryKey).toBe('ignore');
      expect(ast.shape.id).toBeInstanceOf(IntegerColumn);
      expect(ast.shape.name).toBeInstanceOf(TextColumn);
    });

    it('should rename column to camelCase and save original name in data.name', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [
            dbStructureMockFactory.intColumn({ name: '__column__name__' }),
          ],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.columnName).toBeInstanceOf(IntegerColumn);
      expect(ast.shape.columnName.data.name).toBe('__column__name__');
    });

    it('should add array column', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [dbStructureMockFactory.intColumn({ arrayDims: 1 })],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.column).toBeInstanceOf(ArrayColumn);
      expect(
        (
          ast.shape.column as ArrayColumn<
            DefaultSchemaConfig,
            IntegerColumn<DefaultSchemaConfig>,
            unknown,
            unknown,
            unknown
          >
        ).data.item,
      ).toBeInstanceOf(IntegerColumn);
    });

    it('should support enum column', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [dbStructureMockFactory.enumColumn()],
        }),
      ];
      structure.enums = [dbStructureMockFactory.enum()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.column).toBeInstanceOf(EnumColumn);
      expect(
        (ast.shape.column as EnumColumn<DefaultSchemaConfig, unknown, string[]>)
          .enumName,
      ).toBe(`${structure.enums[0].schemaName}.${structure.enums[0].name}`);
      expect(
        (ast.shape.column as EnumColumn<DefaultSchemaConfig, unknown, string[]>)
          .options,
      ).toBe(structure.enums[0].values);
    });

    it('should support column with checks', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [dbStructureMockFactory.intColumn()],
        }),
      ];
      const check = dbStructureMockFactory.check();
      structure.constraints = [check, { ...check, name: check.name + '1' }];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.column.data.checks).toEqual([
        {
          sql: new RawSQL([
            [check.check.expression],
          ] as unknown as TemplateLiteralArgs),
        },
        {
          sql: new RawSQL([
            [check.check.expression],
          ] as unknown as TemplateLiteralArgs),
        },
      ]);
    });

    it('should support column of custom type', async () => {
      const column = dbStructureMockFactory.intColumn({ type: 'customType' });

      structure.tables = [
        dbStructureMockFactory.table({
          columns: [column],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.column).toBeInstanceOf(CustomTypeColumn);
      expect(ast.shape.column.dataType).toBe('customType');

      expect(ctx.unsupportedTypes).toEqual({
        customType: [`${column.schemaName}.${column.tableName}.${column.name}`],
      });
    });

    it('should support column of domain type', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [
            dbStructureMockFactory.domainColumn({
              arrayDims: 1,
            }),
          ],
        }),
      ];
      const [domain] = (structure.domains = [dbStructureMockFactory.domain()]);

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      const array = ast.shape.column;
      expect(array).toBeInstanceOf(ArrayColumn);

      const column = (
        array as ArrayColumn<
          DefaultSchemaConfig,
          DomainColumn<DefaultSchemaConfig>,
          unknown,
          unknown,
          unknown
        >
      ).data.item;
      expect(column.dataType).toBe(`${domain.schemaName}.${domain.name}`);
      expect(column.data.as).toBeInstanceOf(IntegerColumn);
    });

    it('should wrap column default into raw', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [
            dbStructureMockFactory.timestampColumn({ default: 'now()' }),
          ],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      const { default: def } = ast.shape.timestamp.data;
      expect(def && typeof def === 'object' && isRawSQL(def)).toBe(true);
      expect(def).toEqual(raw`now()`);
    });

    it('should replace current_timestamp and transaction_timestamp() with now() in timestamp default', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          columns: [
            dbStructureMockFactory.timestampColumn({
              name: 'one',
              default: 'current_timestamp',
            }),
            dbStructureMockFactory.timestampColumn({
              name: 'two',
              default: 'transaction_timestamp()',
            }),
            dbStructureMockFactory.timestampColumn({
              name: 'three',
              default: 'now()',
            }),
          ],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.shape.one.data.default).toEqual(raw`now()`);
      expect(ast.shape.two.data.default).toEqual(raw`now()`);
      expect(ast.shape.three.data.default).toEqual(raw`now()`);
    });

    describe('serial column', () => {
      it('should add serial column based on various default values', async () => {
        const [table] = (structure.tables = [dbStructureMockFactory.table()]);

        const defaults = [
          `nextval('table_id_seq'::regclass)`,
          `nextval('"table_id_seq"'::regclass)`,
          `nextval('schema.table_id_seq'::regclass)`,
          `nextval('schema."table_id_seq"'::regclass)`,
          `nextval('"schema".table_id_seq'::regclass)`,
          `nextval('"schema"."table_id_seq"'::regclass)`,
        ];

        for (const def of defaults) {
          table.columns = [
            dbStructureMockFactory.intColumn({
              name: 'id',
              schemaName: 'schema',
              default: def,
            }),
          ];

          const [ast] = (await structureToAst(ctx, adapter, config)) as [
            RakeDbAst.Table,
          ];

          expect(ast.shape.id).toBeInstanceOf(SerialColumn);
          expect(ast.shape.id.data.default).toBe(undefined);
        }
      });

      it('should support smallserial, serial, and bigserial', async () => {
        const [table] = (structure.tables = [dbStructureMockFactory.table()]);

        const types = [
          ['int2', SmallSerialColumn],
          ['int4', SerialColumn],
          ['int8', BigSerialColumn],
        ] as const;

        for (const [type, Column] of types) {
          table.columns = [
            dbStructureMockFactory.intColumn({
              type,
              name: 'id',
              schemaName: 'schema',
              default: `nextval('table_id_seq'::regclass)`,
            }),
          ];

          const [ast] = (await structureToAst(ctx, adapter, config)) as [
            RakeDbAst.Table,
          ];

          expect(ast.shape.id).toBeInstanceOf(Column);
          expect(ast.shape.id.data.default).toBe(undefined);
        }
      });
    });

    it('should set maxChars to char column', async () => {
      const varcharColumn = dbStructureMockFactory.varcharColumn();

      structure.tables = [
        dbStructureMockFactory.table({
          columns: [varcharColumn],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      const column = ast.shape[varcharColumn.name];
      expect(column).toBeInstanceOf(VarCharColumn);
      expect(column.data.maxChars).toBe(varcharColumn.maxChars);
    });

    it('should set numericPrecision and numericScale to decimal column', async () => {
      const decimalColumn = dbStructureMockFactory.decimalColumn();

      structure.tables = [
        dbStructureMockFactory.table({
          columns: [decimalColumn],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      const column = ast.shape[decimalColumn.name];
      expect(column).toBeInstanceOf(DecimalColumn);
      expect(column.data.numericPrecision).toBe(decimalColumn.numericPrecision);
      expect(column.data.numericScale).toBe(decimalColumn.numericScale);
    });

    it('should set dateTimePrecision to timestamp column', async () => {
      const timestampColumn = dbStructureMockFactory.timestampColumn({
        dateTimePrecision: 10,
      });

      structure.tables = [
        dbStructureMockFactory.table({
          columns: [timestampColumn],
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      const column = ast.shape[timestampColumn.name];
      expect(column).toBeInstanceOf(TimestampTZColumn);
      expect(column.data.dateTimePrecision).toBe(10);
    });

    it('should set primaryKey to column', async () => {
      structure.tables = [dbStructureMockFactory.tableWithColumns()];
      structure.constraints = [dbStructureMockFactory.primaryKey()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.data.primaryKey).toBe(true);
      expect(ast.primaryKey).toBe(undefined);
    });

    it('should add composite primary key', async () => {
      structure.tables = [dbStructureMockFactory.tableWithColumns()];
      structure.constraints = [
        dbStructureMockFactory.primaryKey({
          primaryKey: ['id', 'name'],
          name: 'pkey',
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.data.primaryKey).toBe(undefined);
      expect(ast.primaryKey).toEqual({
        columns: ['id', 'name'],
        name: 'pkey',
      });
    });

    it('should ignore primary key name if it is standard', async () => {
      structure.tables = [dbStructureMockFactory.tableWithColumns()];
      structure.constraints = [
        dbStructureMockFactory.primaryKey({
          primaryKey: ['id', 'name'],
          name: 'table_pkey',
        }),
      ];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Table,
      ];

      expect(ast.noPrimaryKey).toBe('error');
      expect(ast.shape.id.data.primaryKey).toBe(undefined);
      expect(ast.primaryKey).toEqual({
        columns: ['id', 'name'],
      });
    });

    describe('indexes', () => {
      it('should add index to column', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.indexes = [
          dbStructureMockFactory.index({ nullsNotDistinct: true }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.indexes).toEqual([
          {
            options: {
              nullsNotDistinct: true,
            },
            name: 'index',
          },
        ]);
        expect(ast.indexes).toHaveLength(0);
      });

      it('should ignore standard index name', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.indexes = [
          dbStructureMockFactory.index({
            name: getIndexName('table', [{ column: 'name' }]),
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.indexes).toEqual([
          {
            options: {},
            unique: undefined,
          },
        ]);
        expect(ast.indexes).toHaveLength(0);
      });

      it('should set index options to column index', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.indexes = [
          dbStructureMockFactory.index({
            using: 'gist',
            unique: true,
            nullsNotDistinct: true,
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
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.indexes).toEqual([
          {
            options: {
              using: 'gist',
              unique: true,
              collate: 'en_US',
              opclass: 'varchar_ops',
              order: 'DESC',
              include: ['id'],
              nullsNotDistinct: true,
              with: 'fillfactor=80',
              tablespace: 'tablespace',
              where: 'condition',
            },
            name: 'index',
          },
        ]);
        expect(ast.indexes).toHaveLength(0);
      });

      it('should add composite indexes to the table', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.indexes = [
          dbStructureMockFactory.index({
            columns: [{ column: 'id' }, { column: 'name' }],
          }),
          dbStructureMockFactory.index({
            columns: [{ column: 'id' }, { column: 'name' }],
            unique: true,
            nullsNotDistinct: true,
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.indexes).toBe(undefined);
        expect(ast.indexes).toEqual([
          {
            columns: [{ column: 'id' }, { column: 'name' }],
            options: {},
            name: 'index',
          },
          {
            columns: [{ column: 'id' }, { column: 'name' }],
            options: { unique: true, nullsNotDistinct: true },
            name: 'index',
          },
        ]);
      });

      it('should ignore standard index name in a composite index', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];

        const indexColumns = [{ column: 'id' }, { column: 'name' }];
        structure.indexes = [
          dbStructureMockFactory.index({
            columns: indexColumns,
            name: getIndexName('table', indexColumns),
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.indexes).toBe(undefined);
        expect(ast.indexes).toEqual([
          {
            columns: indexColumns,
            options: { unique: undefined },
          },
        ]);
      });

      it('should add index with expression and options to the table', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.indexes = [
          dbStructureMockFactory.index({
            using: 'gist',
            unique: true,
            nullsNotDistinct: true,
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
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
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
              using: 'gist',
              unique: true,
              nullsNotDistinct: true,
              include: ['id'],
              with: 'fillfactor=80',
              tablespace: 'tablespace',
              where: 'condition',
            },
            name: 'index',
          },
        ]);
      });
    });

    describe('excludes', () => {
      it('should add exclude to column', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.excludes = [
          dbStructureMockFactory.exclude({ nullsNotDistinct: true }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];

        expect(ast.shape.name.data.excludes).toEqual([
          {
            name: 'exclude',
            options: {
              nullsNotDistinct: true,
            },
            with: '=',
          },
        ]);
        expect(ast.excludes).toHaveLength(0);
      });

      it('should ignore standard exclude name', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.excludes = [
          dbStructureMockFactory.exclude({
            name: getExcludeName('table', [{ column: 'name' }]),
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.excludes).toEqual([
          {
            options: {},
            unique: undefined,
            with: '=',
          },
        ]);
        expect(ast.excludes).toHaveLength(0);
      });

      it('should set exclude options to column exclude', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.excludes = [
          dbStructureMockFactory.exclude({
            using: 'gist',
            unique: true,
            nullsNotDistinct: true,
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
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.excludes).toEqual([
          {
            options: {
              using: 'gist',
              unique: true,
              collate: 'en_US',
              opclass: 'varchar_ops',
              order: 'DESC',
              include: ['id'],
              nullsNotDistinct: true,
              with: 'fillfactor=80',
              tablespace: 'tablespace',
              where: 'condition',
            },
            name: 'exclude',
            with: '=',
          },
        ]);
        expect(ast.excludes).toHaveLength(0);
      });

      it('should add composite excludes to the table', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.excludes = [
          dbStructureMockFactory.exclude({
            columns: [{ column: 'id' }, { column: 'name' }],
            exclude: ['<>', '&&'],
          }),
          dbStructureMockFactory.exclude({
            columns: [{ column: 'id' }, { column: 'name' }],
            unique: true,
            nullsNotDistinct: true,
            exclude: ['<>', '&&'],
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.excludes).toBe(undefined);
        expect(ast.excludes).toEqual([
          {
            columns: [
              { column: 'id', with: '<>' },
              { column: 'name', with: '&&' },
            ],
            options: {},
            name: 'exclude',
          },
          {
            columns: [
              { column: 'id', with: '<>' },
              { column: 'name', with: '&&' },
            ],
            options: { unique: true, nullsNotDistinct: true },
            name: 'exclude',
          },
        ]);
      });

      it('should ignore standard exclude name in a composite exclude', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];

        const excludeColumns = [
          { column: 'id', with: '<>' },
          { column: 'name', with: '&&' },
        ];
        structure.excludes = [
          dbStructureMockFactory.exclude({
            columns: excludeColumns,
            name: getExcludeName('table', excludeColumns),
            exclude: ['<>', '&&'],
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.excludes).toBe(undefined);
        expect(ast.excludes).toEqual([
          {
            columns: excludeColumns,
            options: { unique: undefined },
          },
        ]);
      });

      it('should add exclude with expression and options to the table', async () => {
        structure.tables = [dbStructureMockFactory.tableWithColumns()];
        structure.excludes = [
          dbStructureMockFactory.exclude({
            using: 'gist',
            unique: true,
            nullsNotDistinct: true,
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
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];
        expect(ast.shape.name.data.excludes).toBe(undefined);
        expect(ast.excludes).toEqual([
          {
            columns: [
              {
                expression: 'lower(name)',
                collate: 'en_US',
                opclass: 'varchar_ops',
                order: 'DESC',
                with: '=',
              },
            ],
            options: {
              using: 'gist',
              unique: true,
              nullsNotDistinct: true,
              include: ['id'],
              with: 'fillfactor=80',
              tablespace: 'tablespace',
              where: 'condition',
            },
            name: 'exclude',
          },
        ]);
      });
    });

    it('should add foreign key to the column', async () => {
      structure.tables = [
        dbStructureMockFactory.table({ name: 'table1' }),
        dbStructureMockFactory.table({
          name: 'table2',
          columns: [
            dbStructureMockFactory.intColumn({
              name: 'otherId',
            }),
          ],
        }),
      ];
      structure.constraints = [
        dbStructureMockFactory.foreignKey('table2', 'table1'),
      ];

      const [, ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toEqual([
        {
          foreignColumns: ['id'],
          fnOrTable: 'public.table1',
          options: {
            name: 'fkey',
          },
        },
      ]);
      expect(ast.constraints).toHaveLength(0);
    });

    it('should ignore standard foreign key name', async () => {
      structure.tables = [
        dbStructureMockFactory.table({ name: 'table1' }),
        dbStructureMockFactory.table({
          name: 'table2',
          columns: [
            dbStructureMockFactory.intColumn({
              name: 'otherId',
            }),
          ],
        }),
      ];
      structure.constraints = [
        dbStructureMockFactory.foreignKey('table2', 'table1', {
          name: `table2_otherId_fkey`,
        }),
      ];

      const [, ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toEqual([
        {
          foreignColumns: ['id'],
          fnOrTable: 'public.table1',
          options: {},
        },
      ]);
      expect(ast.constraints).toHaveLength(0);
    });

    it('should add composite foreign key', async () => {
      structure.tables = [
        dbStructureMockFactory.table({ name: 'table1' }),
        dbStructureMockFactory.table({
          name: 'table2',
          columns: [
            dbStructureMockFactory.intColumn({
              name: 'otherId',
            }),
          ],
        }),
      ];
      structure.constraints = [
        dbStructureMockFactory.foreignKey('table2', 'table1', {
          references: {
            columns: ['name', 'id'],
            foreignColumns: ['otherName', 'otherId'],
          },
        }),
      ];

      const [, ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toBe(undefined);
      expect(ast.constraints).toEqual([
        {
          name: 'fkey',
          references: {
            columns: ['name', 'id'],
            fnOrTable: 'public.table1',
            foreignColumns: ['otherName', 'otherId'],
            options: {
              name: 'fkey',
            },
          },
        },
      ]);
    });

    it('should ignore standard foreign key name in a composite foreign key', async () => {
      structure.tables = [
        dbStructureMockFactory.table({ name: 'table1' }),
        dbStructureMockFactory.table({
          name: 'table2',
          columns: [
            dbStructureMockFactory.intColumn({
              name: 'otherId',
            }),
          ],
        }),
      ];
      structure.constraints = [
        dbStructureMockFactory.foreignKey('table2', 'table1', {
          name: 'table2_name_otherId_fkey',
          references: {
            columns: ['name', 'otherId'],
            foreignColumns: ['name', 'id'],
          },
        }),
      ];

      const [, ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.shape.otherId.data.foreignKeys).toBe(undefined);
      expect(ast.constraints).toEqual([
        {
          references: {
            columns: ['name', 'otherId'],
            fnOrTable: 'public.table1',
            foreignColumns: ['name', 'id'],
            options: {},
          },
        },
      ]);
    });

    it('should add foreign key to the same table', async () => {
      const [table] = (structure.tables = [
        dbStructureMockFactory.tableWithColumns(),
      ]);
      structure.constraints = [
        dbStructureMockFactory.foreignKey(table.name, table.name),
      ];

      const [ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.name).toBe(table.name);
    });

    it('should add standalone foreign key when it is recursive', async () => {
      structure.tables = [
        dbStructureMockFactory.table({
          name: 'table1',
          columns: [dbStructureMockFactory.intColumn()],
        }),
        dbStructureMockFactory.table({
          name: 'table2',
          columns: [dbStructureMockFactory.intColumn()],
        }),
      ];
      structure.constraints = [
        dbStructureMockFactory.foreignKey('table1', 'table2', {
          references: {
            columns: ['column'],
          },
        }),
        dbStructureMockFactory.foreignKey('table2', 'table1', {
          references: {
            columns: ['column'],
          },
        }),
      ];

      const [table1, table2, fkey] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(table1.name).toBe('table1');
      expect(table1.shape.column.data.foreignKeys).toBe(undefined);
      expect(table2.name).toBe('table2');
      expect(table2.shape.column.data.foreignKeys).toEqual([
        {
          fnOrTable: 'public.table1',
          foreignColumns: ['id'],
          options: {
            name: 'fkey',
          },
        },
      ]);

      expect(fkey).toEqual({
        type: 'constraint',
        action: 'create',
        tableName: 'table1',
        tableSchema: 'public',
        name: 'fkey',
        references: {
          columns: ['column'],
          fnOrTable: 'public.table2',
          foreignColumns: ['id'],
          options: {
            name: 'fkey',
          },
        },
      });
    });

    describe('identity', () => {
      it('should add `as default` identity', async () => {
        const column = dbStructureMockFactory.identityColumn();
        structure.tables = [
          dbStructureMockFactory.table({
            columns: [column],
          }),
        ];

        const [{ shape }] = (await structureToAst(
          ctx,
          adapter,
          config,
        )) as RakeDbAst.Table[];

        expect(shape.identity.data.identity).toEqual({
          start: 1,
          increment: 1,
          cache: 1,
          cycle: false,
        });
      });

      it('should add `always` identity with options', async () => {
        const options = {
          always: true,
          start: 2,
          increment: 3,
          min: 4,
          max: 5,
          cache: 6,
          cycle: true,
        };

        structure.tables = [
          dbStructureMockFactory.table({
            columns: [
              dbStructureMockFactory.identityColumn({ identity: options }),
            ],
          }),
        ];

        const [{ shape }] = (await structureToAst(
          ctx,
          adapter,
          config,
        )) as RakeDbAst.Table[];

        expect(shape.identity.data.identity).toEqual(options);
      });
    });

    describe('column extension', () => {
      it('should preserve column extension', async () => {
        structure.tables = [
          dbStructureMockFactory.table({
            columns: [
              dbStructureMockFactory.column({
                name: 'column',
                type: 'custom',
                extension: 'custom',
              }),
            ],
          }),
        ];

        const [ast] = (await structureToAst(ctx, adapter, config)) as [
          RakeDbAst.Table,
        ];

        const { column } = ast.shape;
        expect(column).toBeInstanceOf(CustomTypeColumn);
        expect(column.data).toMatchObject({
          extension: 'custom',
        });
      });
    });
  });

  describe('constraint', () => {
    it('should add constraint with references and check', async () => {
      structure.tables = [dbStructureMockFactory.table()];
      structure.constraints = [
        {
          ...dbStructureMockFactory.check({ check: { expression: 'check' } }),
          ...dbStructureMockFactory.foreignKey('table', 'otherTable', {
            references: {
              columns: ['id', 'name'],
              foreignColumns: ['foreignId', 'foreignName'],
            },
          }),
          name: 'constraintName',
        },
      ];

      const [ast] = (await structureToAst(
        ctx,
        adapter,
        config,
      )) as RakeDbAst.Table[];

      expect(ast.constraints).toEqual([
        {
          name: 'constraintName',
          references: {
            columns: ['id', 'name'],
            foreignColumns: ['foreignId', 'foreignName'],
            fnOrTable: `public.otherTable`,
            options: {
              name: 'constraintName',
            },
          },
          check: raw({ raw: 'check' }),
        },
      ]);
    });
  });

  describe('extension', () => {
    it('should add extension', async () => {
      structure.extensions = [dbStructureMockFactory.extension()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Extension,
      ];

      expect(ast).toEqual({
        type: 'extension',
        action: 'create',
        schema: 'public',
        name: 'name',
        version: '123',
      });
    });

    it('should not ignore schema if it is not current schema', async () => {
      structure.extensions = [dbStructureMockFactory.extension()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Extension,
      ];

      expect(ast).toEqual({
        type: 'extension',
        action: 'create',
        schema: 'public',
        name: 'name',
        version: '123',
      });
    });
  });

  describe('enum', () => {
    it('should add enum', async () => {
      const [enumType] = (structure.enums = [
        dbStructureMockFactory.enum({ schemaName: 'custom' }),
      ]);

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Enum,
      ];

      expect(ast).toEqual({
        type: 'enum',
        action: 'create',
        name: 'mood',
        values: enumType.values,
      });
    });

    it('should not ignore schema if it is not a current schema', async () => {
      const [enumType] = (structure.enums = [dbStructureMockFactory.enum()]);

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Enum,
      ];

      expect(ast).toEqual({
        type: 'enum',
        action: 'create',
        schema: 'public',
        name: 'mood',
        values: enumType.values,
      });
    });
  });

  describe('domain', () => {
    it('should add domain', async () => {
      const domain = dbStructureMockFactory.domain({
        schemaName: 'custom',
        isNullable: false,
        collate: 'C',
        default: '123',
        checks: ['VALUE = 42'],
      });

      structure.domains = [domain];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Domain,
      ];

      expect(ast).toEqual({
        type: 'domain',
        action: 'create',
        name: domain.name,
        baseType: expect.any(IntegerColumn),
      });

      expect(ast.baseType.data).toMatchObject({
        isNullable: undefined,
        collate: 'C',
        default: raw`123`,
        checks: [{ sql: raw`VALUE = 42` }],
      });
    });

    it('should not ignore schema if it not current schema', async () => {
      structure.domains = [dbStructureMockFactory.domain()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Domain,
      ];

      expect(ast.schema).toBe('public');
    });
  });

  describe('collation', () => {
    it('should add collation', async () => {
      const [collation] = (structure.collations = [
        dbStructureMockFactory.collation({
          schemaName: 'custom',
          lcCollate: 'C',
          lcCType: 'C',
        }),
      ]);

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Collation,
      ];

      expect(ast).toEqual({
        type: 'collation',
        action: 'create',
        ...collation,
        schema: undefined,
        lcCollate: 'C',
        lcCType: 'C',
      });
    });

    it('should not ignore schema if it not current schema', async () => {
      structure.collations = [dbStructureMockFactory.collation()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.Collation,
      ];

      expect(ast.schema).toBe('public');
    });
  });

  describe('view', () => {
    it('should add view', async () => {
      structure.views = [dbStructureMockFactory.view()];

      const [ast] = (await structureToAst(ctx, adapter, config)) as [
        RakeDbAst.View,
      ];

      expect(ast.type).toBe('view');
      expect(ast.action).toBe('create');
      expect(ast.schema).toBe(undefined);
      expect(ast.options.recursive).toBe(true);
      expect(ast.options.with?.checkOption).toBe('LOCAL');
      expect(ast.options.with?.securityBarrier).toBe(true);
      expect(ast.options.with?.securityInvoker).toBe(true);

      const column = ast.shape.column;
      expect(column.dataType).toBe('int4');
    });
  });
});
