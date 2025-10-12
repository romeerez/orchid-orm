import { assertType, columnTypes } from 'test-utils';

const t = columnTypes;

describe('defaultSchemaConfig', () => {
  describe('asType', () => {
    it('accepts narrowed types', () => {
      const column = t
        .text()
        .asType((t) => t<'type', 'input', 'output', 'query'>());

      assertType<typeof column.type, 'type'>();
      assertType<typeof column.inputType, 'input'>();
      assertType<typeof column.outputType, 'output'>();
      assertType<typeof column.queryType, 'query'>();
    });

    it('can set all types from `type`', () => {
      const column = t.text().asType((t) => t<'type'>());

      assertType<typeof column.type, 'type'>();
      assertType<typeof column.inputType, 'type'>();
      assertType<typeof column.outputType, 'type'>();
      assertType<typeof column.queryType, 'type'>();
    });

    it('accepts non-compatible types', () => {
      t.text().asType((t) => t<number>());
      t.text().asType((t) => t<string, number>());
      t.text().asType((t) => t<string, string, number>());
      t.text().asType((t) => t<string, string, string, number>());
    });
  });

  describe('narrowType', () => {
    it('accepts narrowed types', () => {
      const column = t
        .text()
        .narrowType((t) =>
          t<{ input: 'input'; output: 'output'; query: 'query' }>(),
        );

      assertType<typeof column.inputType, 'input'>();
      assertType<typeof column.outputType, 'output'>();
      assertType<typeof column.queryType, 'query'>();
    });

    it('does not accept non-compatible types', () => {
      t.text().narrowType((t) =>
        // @ts-expect-error non-compatible type
        t<{ input: number }>(),
      );

      t.text().narrowType((t) =>
        t<// @ts-expect-error non-compatible type
        {
          input: string;
          output: number;
        }>(),
      );

      t.text().narrowType((t) =>
        t<// @ts-expect-error non-compatible type
        { input: string; output: string; query: number }>(),
      );
    });
  });
});
