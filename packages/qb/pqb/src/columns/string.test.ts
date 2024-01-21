import { TextBaseColumn } from './string';
import {
  assertType,
  testColumnTypes as t,
  testDb,
  TestSchemaConfig,
} from 'test-utils';
import { raw } from '../sql/rawSql';

const testStringColumnMethods = (
  type: TextBaseColumn<TestSchemaConfig> & TestSchemaConfig['stringMethods'],
  name: string,
) => {
  expect(type.nonEmpty().toCode('t')).toBe(`t.${name}().nonEmpty()`);

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
      .ip({ version: 'v4', message: 'ip message' })
      .regex(/\d+/g, 'regex message')
      .includes('includes', 'includes message')
      .startsWith('start', 'startsWith message')
      .endsWith('end', 'endsWith message')
      .trim()
      .toLowerCase()
      .toUpperCase()
      .toCode('t'),
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
      `.ip({ version: 'v4', message: 'ip message' })` +
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
          testDb.sql`'text'::varchar(4)`.type(() => t.varchar(4)),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.varchar().toCode('t')).toBe('t.varchar()');
        expect(t.varchar(5).toCode('t')).toBe('t.varchar(5)');

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
        expect(t.string().toCode('t')).toBe('t.string()');
        expect(t.string(5).toCode('t')).toBe('t.string(5)');

        testStringColumnMethods(t.string(), 'string');
      });
    });

    describe('char', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::char(4)`.type((t) => t.char(4)),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.char().toCode('t')).toBe('t.char()');
        expect(t.char(5).toCode('t')).toBe('t.char(5)');

        testStringColumnMethods(t.char(), 'char');
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
        expect(t.text().toCode('t')).toBe('t.text()');

        expect(t.text(1).toCode('t')).toBe('t.text(1)');
        expect(t.text(1, 2).toCode('t')).toBe('t.text(1, 2)');

        testStringColumnMethods(t.text(), 'text');
      });
    });

    describe('citext', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::citext`.type(() => t.citext(0, Infinity)),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(t.citext(1, 2).toCode('t')).toBe('t.citext(1, 2)');

        const type = t.citext(1, 2);
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
      it('should output Buffer', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::bytea`.type(() => t.bytea()),
        );
        expect(result instanceof Buffer).toBe(true);
        expect(result.toString()).toBe('text');

        assertType<typeof result, Buffer>();
      });

      it('should have toCode', () => {
        expect(t.bytea().toCode('t')).toBe('t.bytea()');
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
        expect(t.point().toCode('t')).toBe('t.point()');
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
        expect(t.line().toCode('t')).toBe('t.line()');
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
        expect(t.lseg().toCode('t')).toBe('t.lseg()');
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
        expect(t.box().toCode('t')).toBe('t.box()');
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
        expect(t.path().toCode('t')).toBe('t.path()');
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
        expect(t.polygon().toCode('t')).toBe('t.polygon()');
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
        expect(t.circle().toCode('t')).toBe('t.circle()');
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
        expect(t.cidr().toCode('t')).toBe('t.cidr()');
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
        expect(t.inet().toCode('t')).toBe('t.inet()');
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
        expect(t.macaddr().toCode('t')).toBe('t.macaddr()');
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
        expect(t.macaddr8().toCode('t')).toBe('t.macaddr8()');
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
        expect(t.bit(5).toCode('t')).toBe('t.bit(5)');
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
        expect(t.bitVarying().toCode('t')).toBe('t.bitVarying()');
        expect(t.bitVarying(5).toCode('t')).toBe('t.bitVarying(5)');
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
        expect(t.tsvector().toCode('t')).toBe('t.tsvector()');
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
        expect(t.tsquery().toCode('t')).toBe('t.tsquery()');
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
      expect(t.uuid().toCode('t')).toBe('t.uuid()');
    });

    describe('primaryKey', () => {
      it('should have a default function to generate uuid', () => {
        const column = t.uuid().primaryKey();

        expect(column.data.default).toEqual(raw({ raw: 'gen_random_uuid()' }));
      });

      it('should not reveal default when converting to code', () => {
        const column = t.uuid().primaryKey();

        expect(column.toCode('t')).toEqual('t.uuid().primaryKey()');
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
      expect(t.xml().toCode('t')).toBe('t.xml()');
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
      expect(t.money().toCode('t')).toBe('t.money()');
    });
  });
});
