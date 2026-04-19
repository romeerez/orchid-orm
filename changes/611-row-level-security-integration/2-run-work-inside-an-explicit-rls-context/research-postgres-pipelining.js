require('dotenv/config');

const postgres = require('postgres');

const sql = postgres(process.env.PG_URL);

const main = async () => {
  const name = `pipeline-repro-${Date.now()}`;
  const password = 'pipeline-password';

  const before = await sql`
    SELECT *
    FROM "schema"."user"
    ORDER BY "id"
  `;

  console.log('Before:');
  console.dir(before, { depth: null });

  const reserved = await sql.reserve();

  try {
    await Promise.all([
      reserved`
        SELECT *
        FROM "schema"."table_that_does_not_exist"
      `,
      reserved`
        INSERT INTO "schema"."user"("name", "password")
        VALUES (${name}, ${password})
        RETURNING *
      `,
    ]);
  } catch (error) {
    console.log('Caught error:');
    console.error(error);
  } finally {
    reserved.release();
  }

  const after = await sql`
    SELECT *
    FROM "schema"."user"
    ORDER BY "id"
  `;

  console.log('After:');
  console.dir(after, { depth: null });
};

main()
  .catch((error) => {
    console.error('Unexpected error:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
