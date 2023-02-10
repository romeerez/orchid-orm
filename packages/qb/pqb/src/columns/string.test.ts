import { assertType, db } from '../test-utils/test-utils';
import {
  BitColumn,
  BitVaryingColumn,
  BoxColumn,
  ByteaColumn,
  CharColumn,
  CidrColumn,
  CircleColumn,
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
  VarCharColumn,
  XMLColumn,
} from './string';

const testNumberColumnMethods = (type: TextBaseColumn, name: string) => {
  expect(type.nonEmpty().toCode('t')).toBe(`t.${name}().nonEmpty()`);

  expect(
    type
      .min(1)
      .max(10)
      .length(15)
      .email()
      .url()
      .uuid()
      .cuid()
      .startsWith('start')
      .endsWith('end')
      .trim()
      .toCode('t'),
  ).toBe(
    `t.${name}().min(1).max(10).length(15).email().url().uuid().cuid().startsWith('start').endsWith('end').trim()`,
  );

  expect(type.regex(/\d+/g).toCode('t')).toBe(`t.${name}().regex(/\\d+/g)`);
};

describe('string columns', () => {
  afterAll(db.close);

  describe('text', () => {
    describe('varchar', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new VarCharColumn(4), `'text'::varchar(4)`),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new VarCharColumn().toCode('t')).toBe('t.varchar()');
        expect(new VarCharColumn(5).toCode('t')).toBe('t.varchar(5)');

        testNumberColumnMethods(new VarCharColumn(), 'varchar');
      });
    });

    describe('char', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new CharColumn(4), `'text'::char(4)`),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new CharColumn().toCode('t')).toBe('t.char()');
        expect(new CharColumn(5).toCode('t')).toBe('t.char(5)');

        testNumberColumnMethods(new CharColumn(), 'char');
      });
    });

    describe('text', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new TextColumn(), `'text'::text`),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new TextColumn().toCode('t')).toBe('t.text()');

        expect(new TextColumn(1).toCode('t')).toBe('t.text(1)');
        expect(new TextColumn(1, 2).toCode('t')).toBe('t.text(1, 2)');

        testNumberColumnMethods(new TextColumn(), 'text');
      });
    });
  });

  describe('binary', () => {
    describe('bytea', () => {
      it('should output Buffer', async () => {
        const result = await db.get(
          db.raw(() => new ByteaColumn(), `'text'::bytea`),
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
        const result = await db.get(
          db.raw(() => new PointColumn(), `'(1, 2)'::point`),
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
        const result = await db.get(
          db.raw(() => new LineColumn(), `'{1, 2, 3}'::line`),
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
        const result = await db.get(
          db.raw(() => new LsegColumn(), `'[(1, 2), (3, 4)]'::lseg`),
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
        const result = await db.get(
          db.raw(() => new BoxColumn(), `'((3, 4), (1, 2))'::box`),
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
        const result = await db.get(
          db.raw(() => new PathColumn(), `'((1, 2), (3, 4))'::path`),
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
        const result = await db.get(
          db.raw(() => new PolygonColumn(), `'((1, 2), (3, 4))'::polygon`),
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
        const result = await db.get(
          db.raw(() => new CircleColumn(), `'<(1,2),3>'::circle`),
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
        const result = await db.get(
          db.raw(() => new CidrColumn(), `'192.168.100.128/25'::cidr`),
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
        const result = await db.get(
          db.raw(() => new InetColumn(), `'192.168.100.128/25'::inet`),
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
        const result = await db.get(
          db.raw(() => new MacAddrColumn(), `'08:00:2b:01:02:03'::macaddr`),
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
        const result = await db.get(
          db.raw(
            () => new MacAddr8Column(),
            `'08:00:2b:ff:fe:01:02:03'::macaddr8`,
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
        const result = await db.get(db.raw(() => new BitColumn(3), `B'101'`));
        expect(result).toBe('101');

        assertType<typeof result, string>();
      });

      it('should have toCode', () => {
        expect(new BitColumn(5).toCode('t')).toBe('t.bit(5)');
      });
    });

    describe('bit varying', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new BitVaryingColumn(), `'10101'::bit varying(5)`),
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
        const result = await db.get(
          db.raw(
            () => new TsVectorColumn(),
            `'a fat cat sat on a mat and ate a fat rat'::tsvector`,
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
        const result = await db.get(
          db.raw(() => new TsQueryColumn(), `'fat & rat'::tsquery`),
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
      const result = await db.get(
        db.raw(
          () => new UUIDColumn(),
          `'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid`,
        ),
      );
      expect(result).toBe(`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`);

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new UUIDColumn().toCode('t')).toBe('t.uuid()');
    });
  });

  describe('xml', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new XMLColumn(), `'<xml></xml>'::xml`),
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
      const result = await db.get(
        db.raw(() => new MoneyColumn(), `'1234567890.42'::money`),
      );
      expect(result).toBe(1234567890.42);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new MoneyColumn().toCode('t')).toBe('t.money()');
    });
  });
});
