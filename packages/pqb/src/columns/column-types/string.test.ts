import {
  assertType,
  testZodColumnTypes as t,
  testDb,
  TestSchemaConfig,
  useTestDatabase,
  sql,
} from 'test-utils';
import { raw } from '../../sql/rawSql';
import { ColumnToCodeCtx } from '../../core';
import { User, userData } from '../../test-utils/test-utils';
import { z } from 'zod/v4';

const ctx: ColumnToCodeCtx = {
  t: 't',
  table: 'table',
  currentSchema: 'public',
};

const testStringColumnMethods = (
  type: ReturnType<
    TestSchemaConfig[
      | 'bigint'
      | 'decimal'
      | 'doublePrecision'
      | 'bigSerial'
      | 'varchar'
      | 'text'
      | 'string'
      | 'citext']
  >,
  name: string,
) => {
  expect(type.nonEmpty().toCode(ctx, 'key')).toBe(`t.${name}().nonEmpty()`);

  expect(
    type
      .min(1, 'min message')
      .max(10, 'max message')
      .length(15, 'length message')
      .email('email message')
      .url('url message')
      .emoji('emoji message')
      .uuid('uuid message')
      .cuid('cuid message')
      .cuid2('cuid2 message')
      .ulid('ulid message')
      .datetime({ offset: true, precision: 5, message: 'datetime message' })
      .ipv4({ message: 'ipv4 message' })
      .ipv6({ message: 'ipv6 message' })
      .regex(/\d+/g, 'regex message')
      .includes('includes', 'includes message')
      .startsWith('start', 'startsWith message')
      .endsWith('end', 'endsWith message')
      .trim()
      .toLowerCase()
      .toUpperCase()
      .toCode(ctx, 'key'),
  ).toBe(
    `t.${name}()` +
      `.min(1, 'min message')` +
      `.max(10, 'max message')` +
      `.length(15, 'length message')` +
      `.email('email message')` +
      `.url('url message')` +
      `.emoji('emoji message')` +
      `.uuid('uuid message')` +
      `.cuid('cuid message')` +
      `.cuid2('cuid2 message')` +
      `.ulid('ulid message')` +
      `.regex(/\\d+/g, 'regex message')` +
      ".includes('includes', 'includes message')" +
      ".startsWith('start', 'startsWith message')" +
      ".endsWith('end', 'endsWith message')" +
      `.datetime({ offset: true, precision: 5, message: 'datetime message' })` +
      `.ipv4({ message: 'ipv4 message' })` +
      `.ipv6({ message: 'ipv6 message' })` +
      '.trim()' +
      '.toLowerCase()' +
      '.toUpperCase()',
  );
};

describe('string columns', () => {
  afterAll(testDb.close);

  describe('text', () => {
    describe('varchar', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::varchar`.type(() => t.varchar()),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.varchar().toCode(ctx, 'key')).toBe('t.varchar()');

        testStringColumnMethods(t.varchar(), 'varchar');
      });
    });

    describe('string', () => {
      it('should be an alias for varchar with limit 255 by default', async () => {
        const column = t.string();

        expect(column.dataType).toBe('varchar');
        expect(column.data.maxChars).toBe(255);
      });

      it('should have toCode', () => {
        expect(t.string().toCode(ctx, 'key')).toBe('t.string()');
        expect(t.string(5).toCode(ctx, 'key')).toBe('t.string(5)');

        testStringColumnMethods(t.string(), 'string');
      });
    });

    describe('text', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::text`.type(() => t.text()),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.text().toCode(ctx, 'key')).toBe('t.text()');

        expect(t.text().min(1).toCode(ctx, 'key')).toBe('t.text().min(1)');
        expect(t.text().min(1).max(2).toCode(ctx, 'key')).toBe(
          't.text().min(1).max(2)',
        );

        testStringColumnMethods(t.text(), 'text');
      });
    });

    describe('citext', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::citext`.type(() => t.citext()),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.citext().min(1).max(2).toCode(ctx, 'key')).toBe(
          't.citext().min(1).max(2)',
        );

        const type = t.citext();
        type.data.minArg =
          type.data.min =
          type.data.maxArg =
          type.data.max =
            undefined;
        testStringColumnMethods(type, 'citext');
      });
    });
  });

  describe('binary', () => {
    describe('bytea', () => {
      it('is a string originally, if we remove the default parser', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::bytea`.type(() =>
            t.bytea().parse(z.string(), (str) => str),
          ),
        );

        assertType<typeof result, string>();

        expect(result).toBe('\\x' + Buffer.from('text').toString('hex'));
      });

      it('should output Buffer', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::bytea`.type(() => t.bytea()),
        );
        expect(result instanceof Buffer).toBe(true);
        expect(result.toString()).toBe('text');

        assertType<typeof result, Buffer>();
      });

      it('should have toCode', () => {
        expect(t.bytea().toCode(ctx, 'key')).toBe('t.bytea()');
      });

      describe('with data', () => {
        useTestDatabase();

        it('should be decoded to a Buffer when sub-selected', async () => {
          await User.create(userData);

          const {
            sub: { bytea },
          } = await User.take().select({
            sub: () =>
              User.take().select({
                bytea: sql`'text'::bytea`.type(() => t.bytea()),
              }),
          });

          expect(bytea instanceof Buffer).toBe(true);
          expect(bytea.toString()).toBe('text');
        });

        // https://github.com/romeerez/orchid-orm/issues/557
        it('should be decoded to a Buffer when sub-selected when having a noop parse', async () => {
          await User.create(userData);

          const {
            sub: { bytea },
          } = await User.take().select({
            sub: () =>
              User.take().select({
                bytea: sql`'text'::bytea`.type(() =>
                  t.bytea().parse(z.unknown(), (buf) => buf),
                ),
              }),
          });

          assertType<typeof bytea, string>();

          expect(bytea).toBe('\\x' + Buffer.from('text').toString('hex'));
        });
      });
    });
  });

  describe('geometric types', () => {
    describe('point', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'(1, 2)'::point`.type(() => t.point()),
        );
        expect(result).toBe('(1,2)');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.point().toCode(ctx, 'key')).toBe('t.point()');
      });
    });

    describe('line', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'{1, 2, 3}'::line`.type(() => t.line()),
        );
        expect(result).toBe('{1,2,3}');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.line().toCode(ctx, 'key')).toBe('t.line()');
      });
    });

    describe('lseg', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'[(1, 2), (3, 4)]'::lseg`.type(() => t.lseg()),
        );
        expect(result).toBe('[(1,2),(3,4)]');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.lseg().toCode(ctx, 'key')).toBe('t.lseg()');
      });
    });

    describe('box', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((3, 4), (1, 2))'::box`.type(() => t.box()),
        );
        expect(result).toBe('(3,4),(1,2)');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.box().toCode(ctx, 'key')).toBe('t.box()');
      });
    });

    describe('path', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((1, 2), (3, 4))'::path`.type(() => t.path()),
        );
        expect(result).toBe('((1,2),(3,4))');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.path().toCode(ctx, 'key')).toBe('t.path()');
      });
    });

    describe('polygon', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((1, 2), (3, 4))'::polygon`.type(() => t.polygon()),
        );
        expect(result).toBe('((1,2),(3,4))');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.polygon().toCode(ctx, 'key')).toBe('t.polygon()');
      });
    });

    describe('circle', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'<(1,2),3>'::circle`.type(() => t.circle()),
        );
        expect(result).toBe('<(1,2),3>');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.circle().toCode(ctx, 'key')).toBe('t.circle()');
      });
    });
  });

  describe('network address types', () => {
    describe('cidr', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'192.168.100.128/25'::cidr`.type(() => t.cidr()),
        );
        expect(result).toBe('192.168.100.128/25');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.cidr().toCode(ctx, 'key')).toBe('t.cidr()');
      });
    });

    describe('inet', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'192.168.100.128/25'::inet`.type(() => t.inet()),
        );
        expect(result).toBe('192.168.100.128/25');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.inet().toCode(ctx, 'key')).toBe('t.inet()');
      });
    });

    describe('macaddr', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'08:00:2b:01:02:03'::macaddr`.type(() => t.macaddr()),
        );
        expect(result).toBe('08:00:2b:01:02:03');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.macaddr().toCode(ctx, 'key')).toBe('t.macaddr()');
      });
    });

    describe('macaddr8', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'08:00:2b:ff:fe:01:02:03'::macaddr8`.type(() =>
            t.macaddr8(),
          ),
        );
        expect(result).toBe('08:00:2b:ff:fe:01:02:03');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.macaddr8().toCode(ctx, 'key')).toBe('t.macaddr8()');
      });
    });
  });

  describe('bit string types', () => {
    describe('bit', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`B'101'`.type(() => t.bit(3)),
        );
        expect(result).toBe('101');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.bit(5).toCode(ctx, 'key')).toBe('t.bit(5)');
      });
    });

    describe('bit varying', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'10101'::bit varying(5)`.type(() => t.bitVarying()),
        );
        expect(result).toBe('10101');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.bitVarying().toCode(ctx, 'key')).toBe('t.bitVarying()');
        expect(t.bitVarying(5).toCode(ctx, 'key')).toBe('t.bitVarying(5)');
      });
    });
  });

  describe('text search types', () => {
    describe('tsvector', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'a fat cat sat on a mat and ate a fat rat'::tsvector`.type(
            () => t.tsvector(),
          ),
        );
        expect(result).toBe(
          `'a' 'and' 'ate' 'cat' 'fat' 'mat' 'on' 'rat' 'sat'`,
        );

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.tsvector().toCode(ctx, 'key')).toBe('t.tsvector()');
      });

      describe('generated', () => {
        describe('toSQL', () => {
          it('should handle template sql', () => {
            const values: unknown[] = [];

            const c = t.tsvector().generated`1 + ${2}`;

            expect(
              c.data.generated?.toSQL({ values, snakeCase: undefined }),
            ).toBe('1 + $1');
            expect(values).toEqual([2]);
          });

          it('should handle raw sql', () => {
            const values: unknown[] = [];

            const c = t
              .tsvector()
              .generated({ raw: '1 + $a', values: { a: 2 } });

            expect(
              c.data.generated?.toSQL({ values, snakeCase: undefined }),
            ).toBe('1 + $1');
            expect(values).toEqual([2]);
          });

          it('for camel case', () => {
            const c = t.tsvector().generated(['aA', 'bB']);

            expect(
              c.data.generated?.toSQL({ values: [], snakeCase: undefined }),
            ).toBe(
              `to_tsvector('english', coalesce("aA", '') || ' ' || coalesce("bB", ''))`,
            );
          });

          it('for snake case', () => {
            const c = t.tsvector().generated(['aA', 'bB']);

            expect(
              c.data.generated?.toSQL({ values: [], snakeCase: true }),
            ).toBe(
              `to_tsvector('english', coalesce("a_a", '') || ' ' || coalesce("b_b", ''))`,
            );
          });
        });

        describe('toCode', () => {
          it('should encode template literal sql', () => {
            const c = t.tsvector().generated`1 + ${2}`;

            expect(c.data.generated?.toCode()).toBe('.generated`1 + ${2}`');
          });

          it('should encode raw sql', () => {
            const c = t
              .tsvector()
              .generated({ raw: '1 + $a', values: { a: 2 } });

            expect(c.data.generated?.toCode()).toBe(
              `.generated({ raw: '1 + $a', values: {"a":2} })`,
            );
          });

          it('should encode columns array', () => {
            const c = t.tsvector().generated(['a', 'b']);

            expect(c.data.generated?.toCode()).toBe(`.generated(['a', 'b'])`);
          });

          it('should encode columns object', () => {
            const c = t.tsvector().generated({ a: 'A', b: 'B' });

            expect(c.data.generated?.toCode()).toBe(
              `.generated({ a: 'A', b: 'B' })`,
            );
          });

          it('should encode language', () => {
            const c = t.tsvector().generated('english', ['a', 'b']);

            expect(c.data.generated?.toCode()).toBe(
              `.generated('english', ['a', 'b'])`,
            );
          });
        });
      });
    });

    describe('tsquery', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'fat & rat'::tsquery`.type(() => t.tsquery()),
        );
        expect(result).toBe(`'fat' & 'rat'`);

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.tsquery().toCode(ctx, 'key')).toBe('t.tsquery()');
      });
    });
  });

  describe('uuid', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid`.type(() =>
          t.uuid(),
        ),
      );
      expect(result).toBe(`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`);

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.uuid().toCode(ctx, 'key')).toBe('t.uuid()');
    });

    describe('primaryKey', () => {
      it('should have a default function to generate uuid', () => {
        const column = t.uuid().primaryKey();

        expect(column.data.default).toEqual(raw({ raw: 'gen_random_uuid()' }));
      });

      it('should not reveal default when converting to code', () => {
        const column = t.uuid().primaryKey();

        expect(column.toCode(ctx, 'key')).toEqual('t.uuid().primaryKey()');
      });

      it('should not change default if it is set by user', () => {
        const column = t.uuid().default('hi').primaryKey();

        expect(column.data.default).toBe('hi');
      });
    });
  });

  describe('xml', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'<xml></xml>'::xml`.type(() => t.xml()),
      );
      expect(result).toBe('<xml></xml>');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.xml().toCode(ctx, 'key')).toBe('t.xml()');
    });
  });

  describe('money', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`'1234567890.42'::money`.type(() => t.money()),
      );
      expect(result).toBe(1234567890.42);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.money().toCode(ctx, 'key')).toBe('t.money()');
    });
  });
});
