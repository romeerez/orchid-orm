import { CustomTypeColumn } from './customType';
import {
  assertType,
  testColumnTypes as t,
  testDb,
  testSchemaConfig,
} from 'test-utils';

describe('custom type column', () => {
  it('should output value of `as` type', () => {
    const string = testDb.get(
      testDb.sql`sql`.type((t) => t.type('name').as(t.text())),
    );
    assertType<Awaited<typeof string>, string>();

    const number = testDb.get(
      testDb.sql`sql`.type((t) => t.type('name').as(t.integer())),
    );
    assertType<Awaited<typeof number>, number>();
  });

  it('should accept value of `as` type', () => {
    const table = testDb('table', (t) => ({
      string: t.type('domainName').as(t.text()).primaryKey(),
      number: t.type('domainName').as(t.integer()),
    }));

    table.create({
      string: 'string',
      number: 123,
    });
  });

  it('should have toCode', () => {
    expect(new CustomTypeColumn(testSchemaConfig, 'name').toCode('t')).toBe(
      `t.type('name')`,
    );
  });
});

describe('domain column', () => {
  it('should have toCode', () => {
    expect(t.domain('name').toCode('t')).toBe(`t.domain('name')`);
  });
});
