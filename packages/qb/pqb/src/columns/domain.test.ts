import { assertType, db } from '../test-utils/test-utils';
import { DomainColumn } from './domain';

describe('domain column', () => {
  it('should output value of `as` type', () => {
    const string = db.get(db.raw((t) => t.domain('name').as(t.text()), 'sql'));
    assertType<Awaited<typeof string>, string>();

    const number = db.get(
      db.raw((t) => t.domain('name').as(t.integer()), 'sql'),
    );
    assertType<Awaited<typeof number>, number>();
  });

  it('should accept value of `as` type', () => {
    const table = db('table', (t) => ({
      string: t.domain('domainName').as(t.text()).primaryKey(),
      number: t.domain('domainName').as(t.integer()),
    }));

    table.create({
      string: 'string',
      number: 123,
    });
  });

  it('should have toCode', () => {
    expect(new DomainColumn({}, 'name').toCode('t')).toBe(`t.domain('name')`);
  });
});
