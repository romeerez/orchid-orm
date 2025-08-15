import {
  ColumnsParsers,
  overrideParserInQuery,
  setParserToQuery,
} from './query/query';
import { noop } from './utils';

describe('query', () => {
  describe.each`
    name                       | fn
    ${'setParserToQuery'}      | ${setParserToQuery}
    ${'overrideParserInQuery'} | ${overrideParserInQuery}
  `('$name', ({ name, fn }) => {
    it('should add parsers object and add a parser to it', () => {
      const q: { parsers?: ColumnsParsers } = {};

      fn(q, 'key', noop);

      expect(q.parsers).toEqual({ key: noop });
    });

    it('should add parser to parsers object if it exists', () => {
      const q: { parsers?: ColumnsParsers } = { parsers: { one: noop } };

      fn(q, 'two', noop);

      expect(q.parsers).toEqual({ one: noop, two: noop });
    });

    if (name === 'setParserToQuery') {
      it('should override existing parser', () => {
        const q: { parsers?: ColumnsParsers } = {
          parsers: {
            key: () => {},
          },
        };

        fn(q, 'key', noop);

        expect(q.parsers).toEqual({ key: noop });
      });
    }

    if (name === 'overrideParserInQuery') {
      it('should wrap one parser with another when there is a parser already', () => {
        const one = jest.fn((v) => Number(v) + 1);
        const two = jest.fn((v) => Number(v) + 2);

        const q: { parsers?: ColumnsParsers } = {
          parsers: {
            key: one,
          },
        };

        fn(q, 'key', two);

        expect(q.parsers?.key?.(1)).toBe(4);
      });
    }
  });
});
