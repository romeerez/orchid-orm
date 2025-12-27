import {
  expectQueryNotMutated,
  Snake,
  User,
} from '../../../test-utils/pqb.test-utils';
import { expectSql, testDb } from 'test-utils';
import { getColumnInfo } from './get-column-info';

describe('columnInfo', () => {
  afterAll(testDb.close);

  it('should return all columns info', async () => {
    const q = User.all();

    const query = getColumnInfo(q);
    expectSql(
      query.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = current_schema()`,
      ['user'],
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

    const query = getColumnInfo(q, 'name');
    expectSql(
      query.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = current_schema() AND column_name = $2`,
      ['user', 'name'],
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

  it('should return info about column with custom name', async () => {
    const query = getColumnInfo(Snake, 'snakeName');
    expectSql(
      query.toSQL(),
      `SELECT * FROM information_schema.columns WHERE table_name = $1 AND table_catalog = current_database() AND table_schema = current_schema() AND column_name = $2`,
      ['snake', 'snake_name'],
    );
  });
});
