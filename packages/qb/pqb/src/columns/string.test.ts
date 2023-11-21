import {
  BitColumn,
  BitVaryingColumn,
  BoxColumn,
  ByteaColumn,
  CharColumn,
  CidrColumn,
  CircleColumn,
  CitextColumn,
  InetColumn,
  LineColumn,
  LsegColumn,
  MacAddr8Column,
  MacAddrColumn,
  MoneyColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  TextBaseColumn,
  TextColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  XMLColumn,
} from './string';
import { assertType, testDb } from 'test-utils';
import { raw } from '../sql/rawSql';
import { columnTypes } from './columnTypes';

const t = columnTypes;

const testStringColumnMethods = (type: TextBaseColumn, name: string) => {
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
          testDb.sql`'text'::char(4)`.type(() => new CharColumn(4)),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new CharColumn().toCode('t')).toBe('t.char()');
        expect(new CharColumn(5).toCode('t')).toBe('t.char(5)');

        testStringColumnMethods(new CharColumn(), 'char');
      });
    });

    describe('text', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::text`.type(() => new TextColumn()),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new TextColumn().toCode('t')).toBe('t.text()');

        expect(new TextColumn(1).toCode('t')).toBe('t.text(1)');
        expect(new TextColumn(1, 2).toCode('t')).toBe('t.text(1, 2)');

        testStringColumnMethods(new TextColumn(), 'text');
      });
    });

    describe('citext', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::citext`.type(() => new CitextColumn()),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new CitextColumn().toCode('t')).toBe('t.citext()');

        expect(new CitextColumn(1).toCode('t')).toBe('t.citext(1)');
        expect(new CitextColumn(1, 2).toCode('t')).toBe('t.citext(1, 2)');

        testStringColumnMethods(new CitextColumn(), 'citext');
      });
    });
  });

  describe('binary', () => {
    describe('bytea', () => {
      it('should output Buffer', async () => {
        const result = await testDb.get(
          testDb.sql`'text'::bytea`.type(() => new ByteaColumn()),
        );
        expect(result instanceof Buffer).toBe(true);
        expect(result.toString()).toBe('text');

        assertType<typeof result, Buffer>();
      });

      it('should have toCode', () => {
        expect(new ByteaColumn().toCode('t')).toBe('t.bytea()');
      });
    });
  });

  describe('geometric types', () => {
    describe('point', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'(1, 2)'::point`.type(() => new PointColumn()),
        );
        expect(result).toBe('(1,2)');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new PointColumn().toCode('t')).toBe('t.point()');
      });
    });

    describe('line', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'{1, 2, 3}'::line`.type(() => new LineColumn()),
        );
        expect(result).toBe('{1,2,3}');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new LineColumn().toCode('t')).toBe('t.line()');
      });
    });

    describe('lseg', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'[(1, 2), (3, 4)]'::lseg`.type(() => new LsegColumn()),
        );
        expect(result).toBe('[(1,2),(3,4)]');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new LsegColumn().toCode('t')).toBe('t.lseg()');
      });
    });

    describe('box', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((3, 4), (1, 2))'::box`.type(() => new BoxColumn()),
        );
        expect(result).toBe('(3,4),(1,2)');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new BoxColumn().toCode('t')).toBe('t.box()');
      });
    });

    describe('path', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((1, 2), (3, 4))'::path`.type(() => new PathColumn()),
        );
        expect(result).toBe('((1,2),(3,4))');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new PathColumn().toCode('t')).toBe('t.path()');
      });
    });

    describe('polygon', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'((1, 2), (3, 4))'::polygon`.type(
            () => new PolygonColumn(),
          ),
        );
        expect(result).toBe('((1,2),(3,4))');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new PolygonColumn().toCode('t')).toBe('t.polygon()');
      });
    });

    describe('circle', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'<(1,2),3>'::circle`.type(() => new CircleColumn()),
        );
        expect(result).toBe('<(1,2),3>');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new CircleColumn().toCode('t')).toBe('t.circle()');
      });
    });
  });

  describe('network address types', () => {
    describe('cidr', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'192.168.100.128/25'::cidr`.type(() => new CidrColumn()),
        );
        expect(result).toBe('192.168.100.128/25');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new CidrColumn().toCode('t')).toBe('t.cidr()');
      });
    });

    describe('inet', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'192.168.100.128/25'::inet`.type(() => new InetColumn()),
        );
        expect(result).toBe('192.168.100.128/25');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new InetColumn().toCode('t')).toBe('t.inet()');
      });
    });

    describe('macaddr', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'08:00:2b:01:02:03'::macaddr`.type(
            () => new MacAddrColumn(),
          ),
        );
        expect(result).toBe('08:00:2b:01:02:03');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new MacAddrColumn().toCode('t')).toBe('t.macaddr()');
      });
    });

    describe('macaddr8', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'08:00:2b:ff:fe:01:02:03'::macaddr8`.type(
            () => new MacAddr8Column(),
          ),
        );
        expect(result).toBe('08:00:2b:ff:fe:01:02:03');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new MacAddr8Column().toCode('t')).toBe('t.macaddr8()');
      });
    });
  });

  describe('bit string types', () => {
    describe('bit', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`B'101'`.type(() => new BitColumn(3)),
        );
        expect(result).toBe('101');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new BitColumn(5).toCode('t')).toBe('t.bit(5)');
      });
    });

    describe('bit varying', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'10101'::bit varying(5)`.type(
            () => new BitVaryingColumn(),
          ),
        );
        expect(result).toBe('10101');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new BitVaryingColumn().toCode('t')).toBe('t.bitVarying()');
        expect(new BitVaryingColumn(5).toCode('t')).toBe('t.bitVarying(5)');
      });
    });
  });

  describe('text search types', () => {
    describe('tsvector', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'a fat cat sat on a mat and ate a fat rat'::tsvector`.type(
            () => new TsVectorColumn(),
          ),
        );
        expect(result).toBe(
          `'a' 'and' 'ate' 'cat' 'fat' 'mat' 'on' 'rat' 'sat'`,
        );

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new TsVectorColumn().toCode('t')).toBe('t.tsvector()');
      });
    });

    describe('tsquery', () => {
      it('should output string', async () => {
        const result = await testDb.get(
          testDb.sql`'fat & rat'::tsquery`.type(() => new TsQueryColumn()),
        );
        expect(result).toBe(`'fat' & 'rat'`);

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new TsQueryColumn().toCode('t')).toBe('t.tsquery()');
      });
    });
  });

  describe('uuid', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid`.type(
          () => new UUIDColumn(),
        ),
      );
      expect(result).toBe(`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`);

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new UUIDColumn().toCode('t')).toBe('t.uuid()');
    });

    describe('primaryKey', () => {
      it('should have a default function to generate uuid', () => {
        const column = new UUIDColumn().primaryKey();

        expect(column.data.default).toEqual(raw({ raw: 'gen_random_uuid()' }));
      });

      it('should not reveal default when converting to code', () => {
        const column = new UUIDColumn().primaryKey();

        expect(column.toCode('t')).toEqual('t.uuid().primaryKey()');
      });

      it('should not change default if it is set by user', () => {
        const column = new UUIDColumn().default('hi').primaryKey();

        expect(column.data.default).toBe('hi');
      });
    });
  });

  describe('xml', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'<xml></xml>'::xml`.type(() => new XMLColumn()),
      );
      expect(result).toBe('<xml></xml>');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new XMLColumn().toCode('t')).toBe('t.xml()');
    });
  });

  describe('money', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`'1234567890.42'::money`.type(() => new MoneyColumn()),
      );
      expect(result).toBe(1234567890.42);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new MoneyColumn().toCode('t')).toBe('t.money()');
    });
  });
});
