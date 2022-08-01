import { AssertEqual } from '../test-utils';
import { TableSchema } from './columnsSchema';
import { columnTypes } from './columnTypes';

describe('columnsSchema', () => {
  describe('schema methods', () => {
    const createSchema = () => {
      return new TableSchema({
        a: columnTypes.integer().primaryKey(),
        b: columnTypes.decimal().primaryKey(),
        c: columnTypes.text(),
      });
    };

    describe('.primaryKeys', () => {
      it('should be array of primary key names', () => {
        const schema = createSchema();
        const eq: AssertEqual<typeof schema.primaryKeys, ['a', 'b']> = true;
        expect(eq).toBe(true);
        expect(schema.primaryKeys).toEqual(['a', 'b']);
      });
    });

    describe('.primaryTypes', () => {
      const schema = createSchema();
      const eq: AssertEqual<typeof schema.primaryTypes, [number, number]> =
        true;
      expect(eq).toBe(true);
      expect(schema.primaryTypes).toEqual(undefined);
    });
  });
});
