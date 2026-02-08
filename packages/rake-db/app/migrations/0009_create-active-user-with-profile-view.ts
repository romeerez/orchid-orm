import { change } from '../db-script';

change(async (db) => {
  await db.createView(
    'schema.activeUserWithProfile',
    `
      SELECT "user".*, p.bio
      FROM "schema"."user"
      JOIN "schema"."profile" p on "user".id = p."user_id"
      WHERE "user"."active"
    `,
  );
});
