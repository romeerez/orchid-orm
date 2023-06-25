import { columnsShapeToCode } from './code';
import { columnTypes } from './columnTypes';
import { codeToString } from 'orchid-core';
import { raw } from '../sql/rawSql';

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
    const tableData = {};

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
                nullsNotDistinct: true,
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
    nullsNotDistinct: true,
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

    it('should add indexes ignoring options when all option values are undefined', () => {
      const code = columnsShapeToCode(
        {},
        {
          ...tableData,
          indexes: [
            {
              columns: [
                {
                  column: 'id',
                  collate: undefined,
                  opclass: undefined,
                  order: undefined,
                },
                {
                  column: 'bool',
                },
              ],
              options: {
                name: undefined,
                unique: undefined,
                using: undefined,
                include: undefined,
                with: undefined,
                tablespace: undefined,
                where: undefined,
                dropMode: undefined,
              },
            },
          ],
        },
        't',
      );

      expect(codeToString(code, '', '  ')).toBe(
        `
...t.index(['id', 'bool']),
        `.trim(),
      );
    });

    describe('constraints', () => {
      describe('constraint', () => {
        it('should add constraint when more than one option is provided', () => {
          const code = columnsShapeToCode(
            {},
            {
              ...tableData,
              constraints: [
                {
                  references: {
                    columns: ['oneId'],
                    fnOrTable: 'table',
                    foreignColumns: ['twoId'],
                    options: {},
                  },
                  check: raw`sql`,
                },
              ],
            },
            't',
          );

          expect(codeToString(code, '', '  ')).toBe(
            `
...t.constraint({
  references: [
    ['oneId'],
    'table',
    ['twoId'],
  ],
  check: t.sql\`sql\`,
}),
`.trim(),
          );
        });
      });

      describe('foreignKeys', () => {
        it('should add foreignKeys', () => {
          class Table {
            table = 'table';
            columns = { shape: {} };
          }

          const code = columnsShapeToCode(
            {},
            {
              ...tableData,
              constraints: [
                {
                  references: {
                    columns: ['oneId'],
                    fnOrTable: 'table',
                    foreignColumns: ['twoId'],
                    options: {},
                  },
                },
                {
                  references: {
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

        it('should ignore options if all options are undefined', () => {
          const code = columnsShapeToCode(
            {},
            {
              ...tableData,
              constraints: [
                {
                  references: {
                    columns: ['oneId'],
                    fnOrTable: 'table',
                    foreignColumns: ['twoId'],
                    options: {},
                  },
                },
                {
                  references: {
                    columns: ['oneId', 'twoId'],
                    fnOrTable: 'otherTable',
                    foreignColumns: ['threeId', 'fourId'],
                    options: {
                      name: undefined,
                      match: undefined,
                      onUpdate: undefined,
                      onDelete: undefined,
                      dropMode: undefined,
                    },
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
  'otherTable',
  ['threeId', 'fourId'],
),
        `.trim(),
          );
        });
      });

      describe('check', () => {
        it('should add table check', () => {
          const code = columnsShapeToCode(
            {},
            {
              ...tableData,
              constraints: [
                {
                  check: raw`sql`,
                },
              ],
            },
            't',
          );

          expect(codeToString(code, '', '  ')).toBe(
            `...t.check(t.sql\`sql\`),`.trim(),
          );
        });
      });
    });

    it('should add column check', () => {
      const code = columnsShapeToCode(
        {
          column: t.integer().check(t.sql`column > ${10}`),
        },
        tableData,
        't',
      );

      expect(code).toEqual([
        `column: t.integer().check(t.sql\`column > \${10}\`),`,
      ]);
    });

    describe('error messages', () => {
      it('should support error messages', () => {
        const code = codeToString(
          t
            .integer()
            .errors({
              required: 'column is required',
              invalidType: 'column must be a number',
            })
            .toCode('t'),
          '',
          '  ',
        );

        expect(code).toBe(
          `t.integer().errors({
  required: 'column is required',
  invalidType: 'column must be a number',
})`,
        );
      });
    });
  });
});
