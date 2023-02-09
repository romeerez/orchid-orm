import { codeToString, columnsShapeToCode } from './code';
import { columnTypes } from './columnTypes';

const t = columnTypes;

describe('code', () => {
  describe('codeToString', () => {
    const code = ['a', ['b', ['c', 'd'], 'e'], 'f'];

    it('should return empty string when empty array given', () => {
      expect(codeToString([], ' ', ' '));
    });

    it('should indent code with spaces', () => {
      const result = codeToString(code, '    ', '  ');

      expect(result).toBe(`    a
      b
        c
        d
      e
    f`);
    });

    it('should indent code with tabs', () => {
      const result = codeToString(code, '\t\t', '\t');

      expect(result).toBe(`\t\ta
\t\t\tb
\t\t\t\tc
\t\t\t\td
\t\t\te
\t\tf`);
    });
  });

  describe('columnsShapeToCode', () => {
    const tableData = {
      indexes: [],
      foreignKeys: [],
    };

    it('should convert columns shape to code', () => {
      const code = columnsShapeToCode(
        {
          id: t.serial().primaryKey(),
          active: t.boolean(),
        },
        tableData,
        't',
      );

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
active: t.boolean(),
        `.trim(),
      );
    });

    it('should handle timestamps', () => {
      const code = columnsShapeToCode(
        {
          id: t.serial().primaryKey(),
          ...t.timestamps(),
        },
        tableData,
        't',
      );

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
...t.timestamps(),
        `.trim(),
      );
    });

    it('should add composite primaryKey', () => {
      const code = columnsShapeToCode(
        {
          id: t.integer(),
          bool: t.boolean(),
        },
        {
          ...tableData,
          primaryKey: {
            columns: ['id', 'bool'],
            options: { name: 'name' },
          },
        },
        't',
      );

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.integer(),
bool: t.boolean(),
...t.primaryKey(['id', 'bool'], { name: 'name' }),
        `.trim(),
      );
    });

    it('should add indexes', () => {
      const code = columnsShapeToCode(
        {
          id: t.integer(),
          bool: t.boolean(),
        },
        {
          ...tableData,
          indexes: [
            {
              columns: [{ column: 'id' }, { column: 'bool' }],
              options: {},
            },
            {
              columns: [{ column: 'id' }],
              options: {
                name: 'indexName',
              },
            },
            {
              columns: [
                {
                  column: 'id',
                  collate: 'collate',
                  opclass: 'opclass',
                  order: 'order',
                },
                {
                  column: 'bool',
                },
              ],
              options: {
                name: 'indexName',
                unique: true,
                using: 'using',
                include: ['one', 'two'],
                with: 'with',
                tablespace: 'tablespace',
                where: 'where',
                dropMode: 'CASCADE',
              },
            },
          ],
        },
        't',
      );

      expect(codeToString(code, '', '  ')).toBe(
        `
id: t.integer(),
bool: t.boolean(),
...t.index(['id', 'bool']),
...t.index(['id'], {
  name: 'indexName',
}),
...t.index(
  [
    {
      column: 'id',
      collate: 'collate',
      opclass: 'opclass',
      order: 'order',
    },
    'bool',
  ],
  {
    name: 'indexName',
    unique: true,
    using: 'using',
    include: ['one', 'two'],
    with: 'with',
    tablespace: 'tablespace',
    where: 'where',
    dropMode: 'CASCADE',
  },
),
        `.trim(),
      );
    });

    it('should add foreignKeys', () => {
      class Table {
        table = 'table';
      }

      const code = columnsShapeToCode(
        {},
        {
          ...tableData,
          foreignKeys: [
            {
              columns: ['oneId'],
              fnOrTable: 'table',
              foreignColumns: ['twoId'],
              options: {},
            },
            {
              columns: ['oneId', 'twoId'],
              fnOrTable: () => Table,
              foreignColumns: ['threeId', 'fourId'],
              options: {
                name: 'name',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                dropMode: 'CASCADE',
              },
            },
          ],
        },
        't',
      );

      expect(codeToString(code, '', '  ')).toBe(
        `
...t.foreignKey(
  ['oneId'],
  'table',
  ['twoId'],
),
...t.foreignKey(
  ['oneId', 'twoId'],
  ()=>Table,
  ['threeId', 'fourId'],
  {
    name: 'name',
    match: 'FULL',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    dropMode: 'CASCADE',
  },
),
        `.trim(),
      );
    });
  });
});
