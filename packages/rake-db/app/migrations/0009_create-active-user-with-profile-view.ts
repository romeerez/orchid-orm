import { change } from '../db-script';

change(async (db) => {
  await db.createView(
    'schema.active_user',
    `
      SELECT "user".*
      FROM "schema"."user"
      WHERE "user"."active"
    `,
  );

  await db.createView(
    'schema.active_user_with_profile',
    `
      SELECT "user".*, p.bio
      FROM "schema"."user"
      JOIN "schema"."profile" p on "user".id = p."user_id"
      WHERE "user"."active"
    `,
  );
});
