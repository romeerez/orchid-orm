import { assertType, columnTypes } from 'test-utils';

const t = columnTypes;
const text = t.text();
const timestamp = t.timestamp();

describe('defaultSchemaConfig', () => {
  describe('asType', () => {
    it('accepts narrowed types', () => {
      const column = text.asType((t) =>
        t<'type', 'input', 'output', 'query'>(),
      );

      assertType<typeof column.type, 'type'>();
      assertType<typeof column.inputType, 'input'>();
      assertType<typeof column.outputType, 'output'>();
      assertType<typeof column.queryType, 'query'>();
    });

    it('can set all types from `type`', () => {
      const column = text.asType((t) => t<'type'>());

      assertType<typeof column.type, 'type'>();
      assertType<typeof column.inputType, 'type'>();
      assertType<typeof column.outputType, 'type'>();
      assertType<typeof column.queryType, 'type'>();
    });

    it('accepts non-compatible types', () => {
      text.asType((t) => t<number>());
      text.asType((t) => t<string, number>());
      text.asType((t) => t<string, string, number>());
      text.asType((t) => t<string, string, string, number>());
    });
  });

  describe('narrowType', () => {
    it('accepts narrowed types', () => {
      const column = text.narrowType((t) => t<'type'>());

      assertType<typeof column.inputType, 'type'>();
      assertType<typeof column.outputType, 'type'>();
      assertType<typeof column.queryType, 'type'>();
    });

    it('does not accept non-compatible types', () => {
      text.narrowType((t) =>
        // @ts-expect-error non-compatible type
        t<number>(),
      );
    });

    it('can be set to a common denominator of columns where input type is different from output, such as timestamp', () => {
      timestamp.narrowType((t) => t<'string'>());

      // @ts-expect-error non-compatible type
      timestamp.narrowType((t) => t<Date>());
    });
  });

  describe('narrowAllTypes', () => {
    it('accepts narrowed types', () => {
      const column = text.narrowAllTypes((t) =>
        t<{ input: 'input'; output: 'output'; query: 'query' }>(),
      );

      assertType<typeof column.inputType, 'input'>();
      assertType<typeof column.outputType, 'output'>();
      assertType<typeof column.queryType, 'query'>();
    });

    it('does not accept non-compatible types', () => {
      text.narrowType((t) =>
        // @ts-expect-error non-compatible type
        t<{ input: number }>(),
      );

      text.narrowType((t) =>
        t<// @ts-expect-error non-compatible type
        {
          input: string;
          output: number;
        }>(),
      );

      text.narrowType((t) =>
        t<// @ts-expect-error non-compatible type
        { input: string; output: string; query: number }>(),
      );
    });
  });
});
