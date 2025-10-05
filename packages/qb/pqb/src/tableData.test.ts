import { assertType, testDb } from 'test-utils';
import { UniqueQueryTypeOrExpression } from './tableData';

type UniqueString = UniqueQueryTypeOrExpression<string>;

describe('tableData', () => {
  describe('unique columns', () => {
    it('should collect unique columns from columns primary keys', () => {
      const table = testDb('table', (t) => ({
        a: t.string().primaryKey(),
        b: t.string().primaryKey(),
        nonUnique: t.text(),
      }));

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString; b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, never>();
    });

    it('should collect unique columns from composite primary keys', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string(),
          b: t.string(),
          nonUnique: t.text(),
        }),
        (t) => t.primaryKey(['a', 'b']),
      );

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString; b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, ['a', 'b']>();
    });

    it('should collect unique columns from composite primary keys defined in array', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string(),
          b: t.string(),
          nonUnique: t.text(),
        }),
        (t) => [t.primaryKey(['a', 'b'])],
      );

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString; b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, ['a', 'b']>();
    });

    it('should collect unique columns from columns indexes', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string().unique(),
          b: t.string().unique(),
          nonUnique: t.text().index(),
        }),
        undefined,
        { noPrimaryKey: 'ignore' },
      );

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString } | { b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, never>();
    });

    it('should collect unique columns from a composite columns index', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string(),
          b: t.string(),
          nonUnique: t.text().index(),
        }),
        (t) => t.unique(['a', 'b']),
        { noPrimaryKey: 'ignore' },
      );

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString; b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, ['a', 'b']>();
    });

    it('should collect unique columns from multiple composite columns indexes', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string(),
          b: t.string(),
          c: t.string(),
          d: t.string(),
          nonUnique: t.text().index(),
        }),
        (t) => [t.unique(['a', 'b']), t.unique(['c', 'd'])],
        { noPrimaryKey: 'ignore' },
      );

      assertType<
        typeof table.internal.uniqueColumns,
        | { a: UniqueString; b: UniqueString }
        | { c: UniqueString; d: UniqueString }
      >();

      assertType<
        typeof table.internal.uniqueColumnTuples,
        ['a', 'b'] | ['c', 'd']
      >();
    });

    // for https://github.com/romeerez/orchid-orm/issues/381
    it('should ignore composite non-unique index', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string().index(),
          b: t.string().unique(),
          c: t.string().unique(),
        }),
        (t) => [t.index(['a']), t.unique(['b']), t.unique(['c'])],
        { noPrimaryKey: 'ignore' },
      );

      assertType<typeof table.internal.uniqueColumnTuples, ['b'] | ['c']>();
    });

    // https://github.com/romeerez/orchid-orm/issues/392
    it('should support unique composite index together with a non-unique index', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.string(),
          b: t.string(),
        }),
        (t) => [t.index(['a']), t.unique(['a', 'b'])],
        { noPrimaryKey: 'ignore' },
      );

      assertType<
        typeof table.internal.uniqueColumns,
        { a: UniqueString; b: UniqueString }
      >();

      assertType<typeof table.internal.uniqueColumnTuples, ['a', 'b']>();
    });
  });

  describe('unique constraints', () => {
    it('should infer a primary key name type from a column', () => {
      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey('pkey'),
      }));

      assertType<typeof table.internal.uniqueConstraints, 'pkey'>();
    });

    it('should not infer a primary key name type from a column when it is not explicitly set', () => {
      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey(),
      }));

      assertType<typeof table.internal.uniqueConstraints, never>();
    });

    it('should infer a primary key name type from a composite primary key', () => {
      const table = testDb(
        'someTable',
        (t) => ({
          id: t.identity(),
          name: t.identity(),
        }),
        (t) => t.primaryKey(['id'], 'pkey'),
      );

      assertType<typeof table.internal.uniqueConstraints, 'pkey'>();
    });

    it('should not infer a primary key name type from a composite primary key when it is not explicitly set', () => {
      const table = testDb(
        'someTable',
        (t) => ({
          id: t.identity(),
          name: t.identity(),
        }),
        (t) => t.primaryKey(['id']),
      );

      assertType<typeof table.internal.uniqueConstraints, never>();
    });

    it('should not infer a primary key name type from a composite primary key in array when it is not explicitly set', () => {
      const table = testDb(
        'someTable',
        (t) => ({
          id: t.identity(),
          name: t.identity(),
        }),
        (t) => [t.primaryKey(['id'])],
      );

      assertType<typeof table.internal.uniqueConstraints, never>();
    });

    it('should infer an index name type from a column unique index', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().unique({ name: 'uniq' }),
        }),
        undefined,
        { noPrimaryKey: 'ignore' },
      );

      assertType<typeof table.internal.uniqueConstraints, 'uniq'>();
    });

    it('should not infer an index name type from a column unique index when it is not explicitly set', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().unique(),
        }),
        undefined,
        { noPrimaryKey: 'ignore' },
      );

      assertType<typeof table.internal.uniqueConstraints, never>();
    });

    it('should infer an index name type from a composite unique index', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.text(),
          b: t.text(),
        }),
        (t) => t.unique(['a', 'b'], { name: 'uniq' }),
        { noPrimaryKey: 'ignore' },
      );

      assertType<typeof table.internal.uniqueConstraints, 'uniq'>();
    });

    it('should not infer an index name type from a composite unique index when it is not explicitly set', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.text(),
          b: t.text(),
        }),
        (t) => t.unique(['a', 'b']),
        { noPrimaryKey: 'ignore' },
      );

      assertType<typeof table.internal.uniqueConstraints, never>();
    });

    it('should collect unique index name types from multiple columns and composite indexes', () => {
      const table = testDb(
        'table',
        (t) => ({
          a: t.text().unique({ name: 'a' }),
          b: t.text().unique({ name: 'b' }),
          c: t.text(),
        }),
        (t) => [
          t.unique(['a', 'b'], { name: 'a_and_b' }),
          t.unique(['b', 'c'], { name: 'b_and_c' }),
        ],
        { noPrimaryKey: 'ignore' },
      );

      assertType<
        typeof table.internal.uniqueConstraints,
        'a' | 'b' | 'a_and_b' | 'b_and_c'
      >();
    });
  });
});
