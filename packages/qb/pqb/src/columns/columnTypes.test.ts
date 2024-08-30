import { columnTypes } from 'test-utils';
import { ColumnType } from './columnType';

it('should parse a null for all column types that have a parse function', () => {
  for (const key in columnTypes) {
    if (key === 'schema' || key === 'timestamps' || key === 'timestampsNoTz')
      continue;

    const fn = columnTypes[key as keyof typeof columnTypes] as (
      ...args: unknown[]
    ) => ColumnType;

    const type =
      key === 'array'
        ? fn.call(columnTypes, columnTypes.integer())
        : fn.call(columnTypes);

    if (!type.parseFn) continue;

    expect(type.parseFn(null)).toBe(null);
  }
});
