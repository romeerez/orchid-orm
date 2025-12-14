import { testDb } from 'test-utils';
import {
  PostgisGeographyPointColumn,
  PostgisPoint,
  postgisTypmodToSql,
} from './postgis';
import { defaultSchemaConfig } from '../default-schema-config';

import { ColumnToCodeCtx } from '../code';

describe('postgis columns', () => {
  afterAll(testDb.close);

  const lon = 35.0462;
  const lat = 48.4647;
  const customSrid = 4267;
  const ctx: ColumnToCodeCtx = {
    t: 't',
    table: 'table',
    currentSchema: 'public',
  };

  describe('geography.point', () => {
    const pointColumn = new PostgisGeographyPointColumn(defaultSchemaConfig);

    it('should parse coords with default srid', async () => {
      const result = await testDb.get(
        testDb.sql`ST_MakePoint(${lon}, ${lat})::geography`.type(
          () => pointColumn,
        ),
      );

      expect(result).toEqual({ lon, lat });
    });

    it('should parse coords with custom srid', async () => {
      const result = await testDb.get(
        testDb.sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), ${customSrid})::geography`.type(
          () => pointColumn,
        ),
      );

      expect(result).toEqual({ lon, lat, srid: customSrid });
    });

    it('should encode coords with default srid', async () => {
      const postgisHex = (await testDb.get(
        testDb.sql`ST_MakePoint(${lon}, ${lat})::geography`,
      )) as string;
      const decoded = pointColumn.data.parse!(postgisHex) as PostgisPoint;

      const encoded = pointColumn.data.encode!(decoded) as string;

      expect(encoded.toUpperCase()).toBe(postgisHex);
    });

    it('should encode coords with custom srid', async () => {
      const postgisHex = (await testDb.get(
        testDb.sql`ST_SetSrid(ST_MakePoint(${lon}, ${lat}), ${customSrid})::geography`,
      )) as string;
      const decoded = pointColumn.data.parse!(postgisHex) as PostgisPoint;

      const encoded = pointColumn.data.encode!(decoded) as string;

      expect(encoded.toUpperCase()).toBe(postgisHex);
    });

    it('should have toCode', () => {
      expect(pointColumn.toCode(ctx, 'key')).toBe(`t.geography.point()`);
    });

    it('should parse typmod to geography arguments', async () => {
      expect(postgisTypmodToSql(1107460)).toBe('Point');
      expect(postgisTypmodToSql(1107464)).toBe('LineString');
      expect(postgisTypmodToSql(1107468)).toBe('Polygon');
      expect(postgisTypmodToSql(1092356)).toBe('Point, 4267');
      expect(postgisTypmodToSql(1092868)).toBe('Point, 4269');
    });
  });
});
