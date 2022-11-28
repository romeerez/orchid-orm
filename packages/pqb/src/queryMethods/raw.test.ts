import { ColumnType } from '../columnSchema';
import { createDb } from '../db';
import { adapter } from '../test-utils/test-utils';

describe('raw', () => {
  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as ColumnType;
    const db = createDb({
      adapter,
      columnTypes: {
        type: () => type,
      },
    });

    const value = db.raw((t) => t.type(), 'sql');

    expect(value.__column).toBe(type);
  });
});
