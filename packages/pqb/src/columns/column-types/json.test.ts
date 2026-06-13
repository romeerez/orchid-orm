import { codeToString, ColumnToCodeCtx } from '../code';
import {
  BaseTable,
  db,
  testZodColumnTypes as t,
  useTestDatabase,
} from 'test-utils';
import { z } from 'zod/v4';
import { orchidORMWithAdapter } from 'orchid-orm';

const ctx: ColumnToCodeCtx = {
  t: 't',
  table: 'table',
  currentSchema: 'public',
};

const ormParams = {
  db: db.$qb,
};

describe('json columns', () => {
  describe('json and jsonText', () => {
    useTestDatabase();

    it('should encode and parse jsonb, should not encode and parse json', async () => {
      class Table extends BaseTable {
        readonly table = 'test-json-columns';
        readonly noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          jsonb: t.json(),
          json: t.jsonText(),
        }));
      }

      const db = orchidORMWithAdapter(ormParams, {
        table: Table,
      });

      await db.$query`CREATE TABLE "test-json-columns" ( "jsonb" jsonb, "json" json )`;

      await db.table.insert({
        jsonb: { jsonb: true },
        json: { json: true },
      });

      const res = await db.table.take();

      expect(res).toEqual({
        jsonb: { jsonb: true },
        json: { json: true },
      });
    });
  });

  describe('json', () => {
    it('should have toCode', () => {
      const code = t.json(z.object({ foo: z.string() })).toCode(ctx, 'key');
      expect(codeToString(code, '', '  ')).toBe(`t.json()`);
    });
  });

  describe('jsonText', () => {
    it('should have toCode', () => {
      expect(t.jsonText().toCode(ctx, 'key')).toBe('t.jsonText()');
    });
  });
});
