import {
  codeToString,
  columnDefaultArgumentToCode,
  columnsShapeToCode,
  ColumnToCodeCtx,
} from './code';
import { testZodColumnTypes as t } from 'test-utils';
import { RawSQL } from '../query/expressions/raw-sql';

const ctx: ColumnToCodeCtx = {
  t: 't',
  table: 'table',
  currentSchema: 'public',
};

describe('code', () => {
  describe('columnDefaultArgumentToCode', () => {
    it('should handle string', () => {
      expect(columnDefaultArgumentToCode('t', 'string')).toBe(`'string'`);
    });

    it('should JSON stringify other values', () => {
      expect(columnDefaultArgumentToCode('t', [{ key: 'value' }])).toBe(
        `[{"key":"value"}]`,
      );
    });

    it('should handle raw SQL', () => {
      expect(
        columnDefaultArgumentToCode(
          't',
          new RawSQL('sql = $key', { key: 'value' }),
        ),
      ).toBe(`t.sql({ raw: 'sql = $key' }).values({"key":"value"})`);
    });

    it('should stringify function', () => {
      expect(columnDefaultArgumentToCode('t', () => Math.random())).toBe(
        `()=>Math.random()`,
      );
    });
  });

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
    it('should convert columns shape to code', () => {
      const code = columnsShapeToCode(ctx, {
        id: t.serial().primaryKey(),
        active: t.boolean(),
      });

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
active: t.boolean(),
        `.trim(),
      );
    });

    it('should handle timestamps', () => {
      const code = columnsShapeToCode(ctx, {
        id: t.serial().primaryKey(),
        ...t.timestamps(),
      });

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
...t.timestamps(),
        `.trim(),
      );
    });

    it('should handle renamed timestamps', () => {
      const code = columnsShapeToCode(ctx, {
        id: t.serial().primaryKey(),
        created: t.timestamps().createdAt,
        updated: t.timestamps().updatedAt,
      });

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
created: t.timestamps().createdAt,
updated: t.timestamps().updatedAt,
        `.trim(),
      );
    });

    describe('error messages', () => {
      it('should support error messages', () => {
        const code = codeToString(
          t
            .integer()
            .error({
              required: 'column is required',
              invalidType: 'column must be a number',
            })
            .toCode(ctx, 'key'),
          '',
          '  ',
        );

        expect(code).toBe(
          `t.integer().error({
  required: 'column is required',
  invalidType: 'column must be a number',
})`,
        );
      });
    });
  });
});
