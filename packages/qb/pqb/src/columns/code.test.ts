import { columnsShapeToCode } from './code';
import { codeToString } from 'orchid-core';
import { testZodColumnTypes as t } from 'test-utils';

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
    it('should convert columns shape to code', () => {
      const code = columnsShapeToCode(
        {
          id: t.serial().primaryKey(),
          active: t.boolean(),
        },
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
        't',
      );

      expect(codeToString(code, '', '  ')).toEqual(
        `
id: t.serial().primaryKey(),
...t.timestamps(),
        `.trim(),
      );
    });

    it('should handle renamed timestamps', () => {
      const code = columnsShapeToCode(
        {
          id: t.serial().primaryKey(),
          created: t.timestamps().createdAt,
          updated: t.timestamps().updatedAt,
        },
        't',
      );

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
            .toCode('t'),
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
