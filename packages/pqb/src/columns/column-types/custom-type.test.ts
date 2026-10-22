import { CustomTypeColumn } from './custom-type';
import {
  assertType,
  testZodColumnTypes as t,
  testDb,
  testSchemaConfig,
} from 'test-utils';

import { ColumnToCodeCtx } from '../code';

const ctx: ColumnToCodeCtx = {
  t: 't',
  table: 'table',
  currentSchema: 'public',
};

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

  it('should preserve nullability when parsing custom types and domains', () => {
    const table = testDb('table', (t) => ({
      value: t.type('custom').parse(String),
      unparsed: t.type('custom'),
      identity: t.type('custom').parse((input) => {
        assertType<typeof input, NonNullable<unknown>>();
        return input;
      }),
      nullableBefore: t.type('custom').nullable().parse(String),
      nullableAfter: t.type('custom').parse(String).nullable(),
      parsedNullBefore: t.type('custom').parseNull(() => false).parse(String),
      parsedNullAfter: t.type('custom').parse(String).parseNull(() => false),
      nullableParsedNull: t
        .type('custom')
        .nullable()
        .parse(String)
        .parseNull(() => false),
      domain: t.domain('custom').parse(String),
      nullableDomain: t.domain('custom').nullable().parse(String),
    }));

    assertType<
      Awaited<typeof table>,
      {
        value: string;
        unparsed: unknown;
        identity: NonNullable<unknown>;
        nullableBefore: string | null;
        nullableAfter: string | null;
        parsedNullBefore: string;
        parsedNullAfter: string;
        nullableParsedNull: string | boolean;
        domain: string;
        nullableDomain: string | null;
      }[]
    >();

    // @ts-expect-error A non-nullable parsed custom type cannot output null.
    const value: Awaited<typeof table>[number]['value'] = null;
    void value;
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
    expect(
      new CustomTypeColumn(testSchemaConfig, 'name').toCode(ctx, 'key'),
    ).toBe(`t.type('name')`);
  });
});

describe('domain column', () => {
  it('should have toCode', () => {
    expect(t.domain('name').toCode(ctx, 'key')).toBe(`t.domain('name')`);
  });
});
