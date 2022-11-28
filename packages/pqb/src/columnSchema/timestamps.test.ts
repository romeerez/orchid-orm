import { db, expectSql, now, useTestDatabase } from '../test-utils/test-utils';

describe('timestamps', () => {
  useTestDatabase();

  const model = db('user', (t) => ({
    name: t.string(),
    ...t.timestamps(),
  }));

  it('should update updatedAt column when updating', async () => {
    const query = model.update({}, true);
    await query;

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "updatedAt" = now()
      `,
    );
  });

  it('should not update updatedAt column when updating it via object', async () => {
    const query = model.update({ updatedAt: now }, true);
    await query;

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "updatedAt" = $1
      `,
      [now],
    );
  });

  it('should update updatedAt when updating with raw sql', async () => {
    const query = model.updateRaw(db.raw('name = $1', 'name'), true);
    await query;

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET name = $1, "updatedAt" = now()
      `,
      ['name'],
    );
  });

  it('should update updatedAt when updating with raw sql which has updatedAt somewhere but not in set', async () => {
    const query = model.updateRaw(db.raw('"createdAt" = "updatedAt"'), true);
    await query;

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "createdAt" = "updatedAt", "updatedAt" = now()
      `,
    );
  });

  it('should not update updatedAt column when updating with raw sql which contains `updatedAt = `', async () => {
    const query = model.updateRaw(db.raw('"updatedAt" = $1', now), true);
    await query;

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "updatedAt" = $1
      `,
      [now],
    );
  });
});
