import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import { db, expectSql, testDb } from 'test-utils';
import { getColumnInfo, GetColumnInfo } from './get-column-info';

describe('columnInfo', () => {
  afterAll(testDb.close);

  it('should use current_schema() if the query has no schema', () => {
    const q = getColumnInfo(db.user.withSchema(undefined));
    expectSql(
      q.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = current_schema()`,
      ['user'],
    );
  });

  it('should return all columns info', async () => {
    const q = db.user.all();

    const query = getColumnInfo(q);
    expectSql(
      query.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = $2`,
      ['user', 'schema'],
    );

    const result = await query;
    // `getColumnInfo` keys results by DB column names at runtime
    expect((result as Record<string, GetColumnInfo>)['name']).toEqual({
      defaultValue: null,
      type: 'text',
      maxLength: null,
      nullable: false,
    });

    expectQueryNotMutated(q);
  });

  it('should return specified column info', async () => {
    const q = db.user.all();

    const query = getColumnInfo(q, 'Name');
    expectSql(
      query.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = $2 AND column_name = $3`,
      ['user', 'schema', 'name'],
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
