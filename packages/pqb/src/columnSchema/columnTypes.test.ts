import { AssertEqual, db } from '../test-utils';
import { raw } from '../common';
import { columnTypes } from './columnTypes';
import { TimeInterval } from './dateTime';

describe('column types', () => {
  describe('numeric types', () => {
    describe('smallint', () => {
      it('should output number', async () => {
        const result = await db.get(raw(columnTypes.smallint(), '1::smallint'));
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('integer', () => {
      it('should output number', async () => {
        const result = await db.get(raw(columnTypes.integer(), '1::integer'));
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('bigint', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.bigint(), '1::bigint'));
        expect(result).toBe('1');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('numeric', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.numeric(), '1::numeric'));
        expect(result).toBe('1');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('decimal', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.decimal(), '1::decimal'));
        expect(result).toBe('1');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('real', () => {
      it('should output number', async () => {
        const result = await db.get(raw(columnTypes.real(), '1::real'));
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('doublePrecision', () => {
      it('should output number', async () => {
        const result = await db.get(
          raw(columnTypes.real(), '1::double precision'),
        );
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('smallSerial', () => {
      it('should output number', async () => {
        const result = await db.get(
          raw(columnTypes.smallSerial(), '1::smallint'),
        );
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('serial', () => {
      it('should output number', async () => {
        const result = await db.get(raw(columnTypes.serial(), '1::integer'));
        expect(result).toBe(1);

        const eq: AssertEqual<typeof result, number> = true;
        expect(eq).toBe(true);
      });
    });

    describe('bigSerial', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.bigSerial(), '1::bigint'));
        expect(result).toBe('1');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('text types', () => {
    describe('varchar', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.varchar(), `'text'::varchar(4)`),
        );
        expect(result).toBe('text');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('char', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.char(), `'text'::char(4)`));
        expect(result).toBe('text');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('text', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.text(), `'text'::text`));
        expect(result).toBe('text');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('string', () => {
      it('should be an alias for the text', async () => {
        const result = await db.get(raw(columnTypes.string(), `'text'::text`));
        expect(result).toBe('text');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('binary data type', () => {
    describe('bytea', () => {
      it('should output Buffer', async () => {
        const result = await db.get(raw(columnTypes.bytea(), `'text'::bytea`));
        expect(result instanceof Buffer).toBe(true);
        expect(result.toString()).toBe('text');

        const eq: AssertEqual<typeof result, Buffer> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('date/time types', () => {
    describe('date', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.date(), `'1999-01-08'::date`),
        );
        expect(result).toBe('1999-01-08');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('timestamp', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.timestamp(), `'1999-01-08 04:05:06'::timestamp`),
        );
        expect(result).toBe('1999-01-08 04:05:06');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('timestamp with time zone', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(
            columnTypes.timestampWithTimeZone(),
            `'1999-01-08 04:05:06 +0'::timestamptz AT TIME ZONE 'UTC'`,
          ),
        );
        expect(result).toBe('1999-01-08 04:05:06');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('time', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.time(), `'12:00'::time`));
        expect(result).toBe('12:00:00');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('time with time zone', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(
            columnTypes.timeWithTimeZone(),
            `'12:00 +0'::timetz AT TIME ZONE 'UTC'`,
          ),
        );
        expect(result).toBe('12:00:00+00');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('interval', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(
            columnTypes.interval(),
            `'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'::interval`,
          ),
        );
        expect(result).toEqual({
          years: 1,
          months: 2,
          days: 3,
          hours: 4,
          minutes: 5,
          seconds: 6,
        });

        const eq: AssertEqual<typeof result, TimeInterval> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('boolean type', () => {
    describe('boolean', () => {
      it('should output boolean', async () => {
        const result = await db.get(raw(columnTypes.boolean(), `true`));
        expect(result).toBe(true);

        const eq: AssertEqual<typeof result, boolean> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('enum type', () => {
    describe('enum', () => {
      beforeAll(async () => {
        await db.adapter.query(`
          DROP TYPE IF EXISTS mood
        `);
        await db.adapter.query(`
          CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
        `);
      });

      type MoodUnion = 'sad' | 'ok' | 'happy';

      enum MoodEnum {
        sad = 'sad',
        ok = 'ok',
        happy = 'happy',
      }

      it('should output proper union', async () => {
        const result = await db.get(
          raw(columnTypes.enum<MoodUnion>('mood'), `'happy'::mood`),
        );
        expect(result).toBe('happy');

        const eq: AssertEqual<typeof result, MoodUnion> = true;
        expect(eq).toBe(true);
      });

      it('should output proper enum', async () => {
        const result = await db.get(
          raw(columnTypes.enum<MoodEnum>('mood'), `'happy'::mood`),
        );
        expect(result).toBe(MoodEnum.happy);

        const eq: AssertEqual<typeof result, MoodEnum> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('geometric types', () => {
    describe('point', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.point(), `'(1, 2)'::point`),
        );
        expect(result).toBe('(1,2)');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('line', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.line(), `'{1, 2, 3}'::line`),
        );
        expect(result).toBe('{1,2,3}');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('lseg', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.lseg(), `'[(1, 2), (3, 4)]'::lseg`),
        );
        expect(result).toBe('[(1,2),(3,4)]');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('box', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.box(), `'((3, 4), (1, 2))'::box`),
        );
        expect(result).toBe('(3,4),(1,2)');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('path', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.path(), `'((1, 2), (3, 4))'::path`),
        );
        expect(result).toBe('((1,2),(3,4))');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('polygon', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.polygon(), `'((1, 2), (3, 4))'::polygon`),
        );
        expect(result).toBe('((1,2),(3,4))');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('circle', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.circle(), `'<(1,2),3>'::circle`),
        );
        expect(result).toBe('<(1,2),3>');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('network address types', () => {
    describe('cidr', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.cidr(), `'192.168.100.128/25'::cidr`),
        );
        expect(result).toBe('192.168.100.128/25');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('inet', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.inet(), `'192.168.100.128/25'::inet`),
        );
        expect(result).toBe('192.168.100.128/25');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('macaddr', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.macaddr(), `'08:00:2b:01:02:03'::macaddr`),
        );
        expect(result).toBe('08:00:2b:01:02:03');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('macaddr8', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.macaddr8(), `'08:00:2b:ff:fe:01:02:03'::macaddr8`),
        );
        expect(result).toBe('08:00:2b:ff:fe:01:02:03');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('bit string types', () => {
    describe('bit', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.bit(3), `B'101'`));
        expect(result).toBe('101');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('bit varying', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.bitVarying(), `'10101'::bit varying(5)`),
        );
        expect(result).toBe('10101');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('text search types', () => {
    describe('tsvector', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(
            columnTypes.tsvector(),
            `'a fat cat sat on a mat and ate a fat rat'::tsvector`,
          ),
        );
        expect(result).toBe(
          `'a' 'and' 'ate' 'cat' 'fat' 'mat' 'on' 'rat' 'sat'`,
        );

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });

    describe('tsquery', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(columnTypes.tsquery(), `'fat & rat'::tsquery`),
        );
        expect(result).toBe(`'fat' & 'rat'`);

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('uuid type', () => {
    describe('uuid', () => {
      it('should output string', async () => {
        const result = await db.get(
          raw(
            columnTypes.uuid(),
            `'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid`,
          ),
        );
        expect(result).toBe(`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`);

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('array type', () => {
    describe('array', () => {
      it('should output nested array of numbers', async () => {
        const result = await db.get(
          raw(
            columnTypes.array(columnTypes.array(columnTypes.integer())),
            `'{{1, 2, 3}, {4, 5, 6}}'::integer[][]`,
          ),
        );
        expect(result).toEqual([
          [1, 2, 3],
          [4, 5, 6],
        ]);

        const eq: AssertEqual<typeof result, number[][]> = true;
        expect(eq).toBe(true);
      });

      it('should output nested array of strings', async () => {
        const result = await db.get(
          raw(
            columnTypes.array(columnTypes.array(columnTypes.text())),
            `'{{"a", "b"}, {"c", "d"}}'::text[][]`,
          ),
        );
        expect(result).toEqual([
          ['a', 'b'],
          ['c', 'd'],
        ]);

        const eq: AssertEqual<typeof result, string[][]> = true;
        expect(eq).toBe(true);
      });

      it('should output nested array of booleans', async () => {
        const result = await db.get(
          raw(
            columnTypes.array(columnTypes.array(columnTypes.boolean())),
            `'{{true}, {false}}'::text[][]`,
          ),
        );
        expect(result).toEqual([[true], [false]]);

        const eq: AssertEqual<typeof result, boolean[][]> = true;
        expect(eq).toBe(true);
      });
    });
  });

  describe('other types', () => {
    describe('money', () => {
      it('should output string', async () => {
        const result = await db.get(raw(columnTypes.money(), `'12.34'::money`));
        expect(result).toBe('$12.34');

        const eq: AssertEqual<typeof result, string> = true;
        expect(eq).toBe(true);
      });
    });
  });
});
