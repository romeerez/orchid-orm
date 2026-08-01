import { testDb, useTestDatabase, db } from 'test-utils';
import { QueryError } from './query';

describe('errors', () => {
  useTestDatabase();

  it('should capture stack trace properly', async () => {
    let err: Error | undefined;

    try {
      await db.user.select({
        column: testDb.sql`koko`.type((t) => t.boolean()),
      });
    } catch (error) {
      err = error as Error;
    }

    expect((err?.cause as Error)?.stack).toContain('errors.test.ts');
  });

  it('should have isUnique and column names map when violating unique error over single column', async () => {
    await db.uniqueTable.create({
      one: 'one',
      two: 1,
      thirdColumn: 'three',
      fourthColumn: 1,
    });

    let err: InstanceType<typeof db.uniqueTable.error> | undefined;

    try {
      await db.uniqueTable.create({
        one: 'one',
        two: 2,
        thirdColumn: 'three',
        fourthColumn: 2,
      });
    } catch (error) {
      if (error instanceof db.uniqueTable.error) {
        err = error;
      }
    }

    expect(err?.getQuery()).toBe(db.uniqueTable);
    expect(err?.isUnique).toBe(true);
    expect(err?.columns).toEqual({
      one: true,
    });
  });

  it('should have isUnique and column names map when violating unique error over multiple columns', async () => {
    await db.uniqueTable.create({
      one: 'one',
      two: 1,
      thirdColumn: 'three',
      fourthColumn: 1,
    });

    let err: QueryError | undefined;

    try {
      await db.uniqueTable.create({
        one: 'two',
        two: 2,
        thirdColumn: 'three',
        fourthColumn: 1,
      });
    } catch (error) {
      if (error instanceof QueryError) {
        err = error;
      }
    }

    expect(err?.getQuery()).toBe(db.uniqueTable);
    expect(err?.isUnique).toBe(true);
    expect(err?.columns).toEqual({
      thirdColumn: true,
      fourthColumn: true,
    });
  });
});
