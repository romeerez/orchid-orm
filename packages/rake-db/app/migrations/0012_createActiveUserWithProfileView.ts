import { change } from '../dbScript';

change(async (db) => {
  await db.createView(
    'activeUserWithProfile',
    `
      SELECT "user".*, p.bio
      FROM "user"
      JOIN profile p on "user".id = p."user_id"
      WHERE "user"."active"
    `,
  );
});
