import { assertType, db } from '../test-utils/test-utils';
import { CustomTypeColumn, DomainColumn } from './customType';

describe('custom type column', () => {
  it('should output value of `as` type', () => {
    const string = db.get(db.raw((t) => t.type('name').as(t.text()), 'sql'));
    assertType<Awaited<typeof string>, string>();

    const number = db.get(db.raw((t) => t.type('name').as(t.integer()), 'sql'));
    assertType<Awaited<typeof number>, number>();
  });

  it('should accept value of `as` type', () => {
    const table = db('table', (t) => ({
      string: t.type('domainName').as(t.text()).primaryKey(),
      number: t.type('domainName').as(t.integer()),
    }));

    table.create({
      string: 'string',
      number: 123,
    });
  });

  it('should have toCode', () => {
    expect(new CustomTypeColumn({}, 'name').toCode('t')).toBe(`t.type('name')`);
  });
});

describe('domain column', () => {
  it('should have toCode', () => {
    expect(new DomainColumn({}, 'name').toCode('t')).toBe(`t.domain('name')`);
  });
});
