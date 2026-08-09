import {
  assertType,
  defineTable,
  sql,
  testDb,
  testOrchidORMWithAdapter,
} from 'test-utils';
import { Branded } from './brand';

type TypeKey = '__inputType' | '__outputType' | '__queryType';

describe('branded columns', () => {
  it('defineTable: should wrap column types with a brand that enforces a table and a column name', () => {
    const table = defineTable('table', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text().brand(),
      email: t.text().brand('email'),
    })).computed(() => ({
      sql: sql`1`.type((t) => t.text().brand()),
      sqlEmail: sql`1`.type((t) => t.text().brand('email')),
    }));

    const db = testOrchidORMWithAdapter({ table });

    const column = db.table.shape.name;

    assertType<(typeof column)[TypeKey], Branded<string, 'table.name'>>();

    const computed = db.table.shape.sql;

    assertType<(typeof computed)[TypeKey], Branded<string, 'table.sql'>>();

    const email = db.table.shape.email;

    assertType<(typeof email)[TypeKey], Branded<string, 'email'>>();

    const sqlEmail = db.table.shape.sqlEmail;

    assertType<(typeof sqlEmail)[TypeKey], Branded<string, 'email'>>();
  });

  it('testDb: should wrap column types with a brand that enforces a table and a column name', () => {
    const table = testDb(
      'table',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().brand(),
        email: t.text().brand('email'),
      }),
      undefined,
      {
        computed: () => ({
          sql: sql`1`.type((t) => t.text().brand()),
          sqlEmail: sql`1`.type((t) => t.text().brand('email')),
        }),
      },
    );

    const column = table.shape.name;

    assertType<(typeof column)[TypeKey], Branded<string, 'table.name'>>();

    const computed = table.shape.sql;

    assertType<(typeof computed)[TypeKey], Branded<string, 'table.sql'>>();

    const email = table.shape.email;

    assertType<(typeof email)[TypeKey], Branded<string, 'email'>>();

    const sqlEmail = table.shape.sqlEmail;

    assertType<(typeof sqlEmail)[TypeKey], Branded<string, 'email'>>();
  });
});
