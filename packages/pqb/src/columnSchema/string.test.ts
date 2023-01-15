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
  TextColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  VarCharColumn,
} from './string';

describe('string columns', () => {
  describe('text', () => {
    describe('varchar', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new VarCharColumn(4), `'text'::varchar(4)`),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
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
    });

    describe('text', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new TextColumn(), `'text'::text`),
        );
        expect(result).toBe('text');

        assertType<typeof result, string>();
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
    });

    describe('line', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new LineColumn(), `'{1, 2, 3}'::line`),
        );
        expect(result).toBe('{1,2,3}');

        assertType<typeof result, string>();
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
    });

    describe('box', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new BoxColumn(), `'((3, 4), (1, 2))'::box`),
        );
        expect(result).toBe('(3,4),(1,2)');

        assertType<typeof result, string>();
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
    });

    describe('polygon', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new PolygonColumn(), `'((1, 2), (3, 4))'::polygon`),
        );
        expect(result).toBe('((1,2),(3,4))');

        assertType<typeof result, string>();
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
    });

    describe('inet', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new InetColumn(), `'192.168.100.128/25'::inet`),
        );
        expect(result).toBe('192.168.100.128/25');

        assertType<typeof result, string>();
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
    });
  });

  describe('bit string types', () => {
    describe('bit', () => {
      it('should output string', async () => {
        const result = await db.get(db.raw(() => new BitColumn(3), `B'101'`));
        expect(result).toBe('101');

        assertType<typeof result, string>();
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
    });

    describe('tsquery', () => {
      it('should output string', async () => {
        const result = await db.get(
          db.raw(() => new TsQueryColumn(), `'fat & rat'::tsquery`),
        );
        expect(result).toBe(`'fat' & 'rat'`);

        assertType<typeof result, string>();
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
  });

  describe('money', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new MoneyColumn(), `'1234567890.42'::money`),
      );
      expect(result).toBe(1234567890.42);

      assertType<typeof result, number>();
    });
  });
});
