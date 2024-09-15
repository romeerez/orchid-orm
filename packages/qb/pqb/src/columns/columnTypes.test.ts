import { columnTypes } from 'test-utils';
import { ColumnType } from './columnType';
import { RecordUnknown } from 'orchid-core';

it('should parse a null for all column types that have a parse function', () => {
  for (const key in columnTypes) {
    if (key === 'schema' || key === 'timestamps' || key === 'timestampsNoTz')
      continue;

    if (key === 'geography') {
      for (const key in columnTypes.geography) {
        check(key, columnTypes.geography);
      }
      continue;
    }

    check(key, columnTypes as unknown as RecordUnknown);
  }
});

function check(key: string, types: RecordUnknown) {
  const fn = types[key as keyof typeof types] as (
    ...args: unknown[]
  ) => ColumnType;

  const type =
    key === 'array'
      ? fn.call(columnTypes, columnTypes.integer())
      : fn.call(types);

  if (!type.parseFn) return;

  expect(type.parseFn(null)).toBe(null);
}
