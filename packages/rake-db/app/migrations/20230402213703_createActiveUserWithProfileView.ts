import { change } from '../../src';

change(async (db) => {
  await db.createView(
    'activeUserWithProfile',
    `
      SELECT "user".*, p.bio
      FROM "user"
      JOIN profile p on "user".id = p."userId"
      WHERE "user"."active"
    `,
  );
});
