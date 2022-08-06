import { expectQueryNotMutated, line, User } from '../test-utils';

describe('columnInfo', () => {
  it('should return all columns info', async () => {
    const q = User.all();

    const query = q.columnInfo();
    expect(query.toSql()).toBe(
      line(
        `SELECT * FROM information_schema.columns WHERE table_name = 'user' AND table_catalog = current_database() AND table_schema = current_schema()`,
      ),
    );

    const result = await query;
    expect(result.name).toEqual({
      defaultValue: null,
      type: 'text',
      maxLength: null,
      nullable: false,
    });

    expectQueryNotMutated(q);
  });

  it('should return specified column info', async () => {
    const q = User.all();

    const query = q.columnInfo('name');
    expect(query.toSql()).toBe(
      line(
        `SELECT * FROM information_schema.columns WHERE table_name = 'user' AND table_catalog = current_database() AND table_schema = current_schema() AND column_name = 'name'`,
      ),
    );

    const result = await query;
    expect(result).toEqual({
      defaultValue: null,
      type: 'text',
      maxLength: null,
      nullable: false,
    });

    expectQueryNotMutated(q);
  });
});
