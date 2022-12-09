import { db, expectSql, now, useTestDatabase } from '../test-utils/test-utils';

describe('timestamps', () => {
  useTestDatabase();

  const model = db('user', (t) => ({
    name: t.text().primaryKey(),
    ...t.timestamps(),
  }));

  it('should update updatedAt column when updating', async () => {
    const query = model.where().update({});
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
    const query = model.where().update({ updatedAt: now });
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
    const query = model
      .where()
      .updateRaw(db.raw('name = $name', { name: 'name' }));

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
    const query = model.where().updateRaw(db.raw('"createdAt" = "updatedAt"'));
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
    const query = model
      .where()
      .updateRaw(db.raw('"updatedAt" = $time', { time: now }));

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
