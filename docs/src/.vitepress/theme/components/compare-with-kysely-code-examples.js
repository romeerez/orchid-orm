export const tables = {
  orchid: `import { createBaseTable, Insertable, orchidORM, Queryable, Updatable } from 'orchid-orm';

export const BaseTable = createBaseTable();

export type PersonFilters = Queryable<PersonTable>
export type PersonUpdate = Updatable<PersonTable>
export type PersonNew = Insertable<PersonTable>
export class PersonTable extends BaseTable {
  readonly table = 'person';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    gender: t.enum('gender', ['man', 'woman', 'other']).nullable(),
    lastName: t.string().nullable(),
    middleName: t.string().nullable(),
    age: t.integer().nullable(),
    createdAt: t.timestamps().createdAt,
    metadata: t.json<{
      login_at: string;
      ip: string | null;
      agent: string | null;
      plan: 'free' | 'premium';
    }>().nullable(),
  }));

  relations = {
    pets: this.hasMany(() => PetTable, {
      columns: ['id'],
      references: ['ownerId']
    }),
  }
}

export class PetTable extends BaseTable {
  readonly table = 'pet'
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    ownerId: t.integer(),
    species: t.enum('specie', ['dog', 'cat']),
    isFavorite: t.boolean(),
  }))
  
  relations = {
    owner: this.belongsTo(() => PersonTable, {
      columns: ['ownerId'],
      references: ['id']
    }),
  }
}

export const db = orchidORM(
  {
    databaseURL: 'postgres://user:password@host/dbname',
    log: false,
  },
  {
    person: PersonTable,
    pet: PetTable,
  },
);
`,
  kysely: `import {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
  Kysely,
  PostgresDialect,
} from 'kysely'
import { Pool } from 'pg'

export interface Database {
  person: PersonTable
  pet: PetTable
}

export interface PersonTable {
  id: Generated<number>
  first_name: string
  gender: 'man' | 'woman' | 'other' | null
  age: number
  last_name: string | null
  created_at: ColumnType<Date, string | undefined, never>
  metadata: JSONColumnType<{
    login_at: string;
    ip: string | null;
    agent: string | null;
    plan: 'free' | 'premium';
  }> | null
}

export type Person = Selectable<PersonTable>
export type NewPerson = Insertable<PersonTable>
export type PersonUpdate = Updateable<PersonTable>

export interface PetTable {
  id: Generated<number>
  name: string
  owner_id: number
  species: 'dog' | 'cat'
  is_favorite: boolean
}

export type Pet = Selectable<PetTable>
export type NewPet = Insertable<PetTable>
export type PetUpdate = Updateable<PetTable>

const dialect = new PostgresDialect({
  pool: new Pool({
    database: 'test',
    host: 'localhost',
    user: 'admin',
    port: 5434,
    max: 10,
  })
})

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<Database>({
  dialect,
})
`,
};

export const compareWithKyselyCodeExamples = {
  Select: [
    {
      name: 'A single column',
      text: `
        <b>OrchidORM</b> returns many records by default, so no need for <code>execute()</code>.
        
        You can use <code>take</code>, <code>takeOptional</code> for <code>executeTakeFirstOrThrow</code> and <code>executeTakeFirst</code> of <b>Kysely</b>.
        
        There are also <code>get</code> for a single value, <code>pluck</code> for a flat array, and other options.
      `,
      orchid: `import { db } from './tables';

const persons = await db.person
  .select('id')
  .where({ firstName: 'Arnold' })
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .select('id')
  .where('first_name', '=', 'Arnold')
  .execute()
`,
    },
    {
      name: 'Column with a table',
      text: `
        When selecting from multiple tables, <b>OrchidORM</b> forbids ambiguous selecting without specifying a table name.
      `,
      orchid: `import { db } from './tables';

const persons = await db
  .$from([db.person, db.pet])
  .select('person.id')
  // ambiguous select is forbidden
  // .select('id')
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom(['person', 'pet'])
  .select('person.id')
  // ambiguous select is allowed
  // .select('id')
  .execute()
`,
    },
    {
      name: 'Multiple columns',
      orchid: `import { db } from './tables';

const persons = await db.person
  .select('id', 'firstName')
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .select(['person.id', 'first_name'])
  .execute()
`,
    },
    {
      name: 'Aliases',
      orchid: `import { db } from './tables';

const persons = await db.person.as('p').select({
  fn: 'firstName',
  ln: 'p.lastName'
})
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person as p')
  .select([
    'first_name as fn',
    'p.last_name as ln'
  ])
  .execute()
`,
    },
    {
      name: 'Complex selections',
      text: `
        <code>q</code> stands for "query builder", but, of course, you can name it differently.
        
        Not that the <code>firstPetName</code> is selected using a <code>LEFT JOIN LATERAL</code>: this is more efficient, and allows to perform an inner join if needed.
      `,
      orchid: `import { db } from './tables';

const persons = await db.person.select({
  // Select a correlated subquery
  firstPetName: (q) =>
    q.pets
      .getOptional('pets.name')
      .order('pets.name'),

  // The same as above,
  // but referencing the join condition explicitly
  firstPetName2: (q) =>
    db.pet
      .getOptional('pet.name')
      .where({ ownerId: q.ref('person.id') })
      .order('pet.name'),

  // Build and select an expression using
  // the expression builder
  isJenniferOrArnold: (q) =>
    q.ref('firstName').equals('Jennifer').or(
      q.ref('firstName').equals('Arnold')
    ),

  // Select a raw sql expression
  fullName: (q) =>
    q.sql<string>\`concat(first_name, ' ', last_name)\`,
})
`,
      kysely: `import { db } from './tables';
import { sql } from 'kysely';

const persons = await db.selectFrom('person')
  .select(({ eb, selectFrom, or }) => [
    // Select a correlated subquery
    selectFrom('pet')
      .whereRef('person.id', '=', 'pet.owner_id')
      .select('pet.name')
      .orderBy('pet.name')
      .limit(1)
      .as('first_pet_name'),

    // Build and select an expression using
    // the expression builder
    or([
      eb('first_name', '=', 'Jennifer'),
      eb('first_name', '=', 'Arnold')
    ]).as('is_jennifer_or_arnold'),

    // Select a raw sql expression
    sql<string>\`concat(first_name, ' ', last_name)\`.as('full_name')
  ])
  .execute()
`,
    },
    {
      name: 'Not null',
      text: `
        The <code>take</code> method acts as a <code>executeTakeFirstOrThrow</code> from <b>Kysely</b>, but here it can also be used on nested selections.
      `,
      orchid: `import { db } from './tables';

const persons = await db.person
  .select('lastName', {
    // \`take()\` will throw if it won't found the pet
    pet: (q) => q.pets.take(),
  })
  .where({ lastName: { not: null } })
  // using \`narrowType\` to remove the null type from the result
  .narrowType()<{ lastName: string }>()
`,
      kysely: `import { db } from './tables';
import { NotNull } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

const persons = await db
  .selectFrom('person')
  .select((eb) => [
    'last_name',
    jsonObjectFrom(
      eb.selectFrom('pet')
        .selectAll('pet')
        .limit(1)
        .whereRef('person.id', '=', 'pet.owner_id')
    // using \`$notNull()\` to remove the null type from the result,
    // this won't fail at runtime if there is no pet
    ).$notNull().as('pet')
  ])
  .where('last_name', 'is not', null)
  // using \`$narrowType\` to remove the null type from the result
  .$narrowType<{ last_name: NotNull }>()
  .execute()
`,
    },
    {
      name: 'Function calls',
      text: `
        Note the <code>.type((t) => t.string())</code> instead of simple <code>&lt;string&gt;</code> in <b>Kysely</b>: this allows to wrap the query into <code>from</code> and to use special where filters that are available only for a string,<br/>such as <code>.where({ fullNameWithTitle: { contains: 'substring' } })</code>.
      `,
      orchid: `import { db } from './tables';

const result = await db.person
  .join('pets') // join is equal to inner join
  .select('person.id', {
    petCount: (q) => q.count('pets.*'),

    fullNameWithTitle: (q) =>
      q.fn('concat', [
        q.val('Ms. '),
        'firstName',
        q.val(' '),
        'lastName',
      ]).type((t) => t.string()),

    petNames: (q) =>
      q.fn('array_agg', ['pets.name']).type((t) => t.array(t.string())),

    fullName: (q) =>
      q.sql<string>\`concat(
        \${q.ref('firstName')},
        ' ',
        \${q.ref('lastName')}
      )\`,
  })
  .group('id')
  .having((q) => q.count('pets.id').gt(10))
`,
      kysely: `import { db } from './tables';
import { sql } from 'kysely'

const result = await db.selectFrom('person')
  .innerJoin('pet', 'pet.owner_id', 'person.id')
  .select(({ fn, val, ref }) => [
    'person.id',

    fn.count<number>('pet.id').as('pet_count'),

    fn<string>('concat', [
      val('Ms. '),
      'first_name',
      val(' '),
      'last_name'
    ]).as('full_name_with_title'),

    fn.agg<string[]>('array_agg', ['pet.name']).as('pet_names'),

    sql<string>\`concat(
      \${ref('first_name')},
      ' ',
      \${ref('last_name')}
    )\`.as('full_name')
  ])
  .groupBy('person.id')
  .having((eb) => eb.fn.count('pet.id'), '>', 10)
  .execute()
`,
    },
    {
      name: 'Distinct',
      orchid: `import { db } from './tables';

const persons = await db.person
  .distinct()
  .select('firstName')
`,
      kysely: `import { db } from './tables';

const persons = await db.selectFrom('person')
  .select('first_name')
  .distinct()
  .execute()
`,
    },
    {
      name: 'All columns',
      orchid: `import { db } from './tables';

// Not supported.
// It is never a good idea to select everything
// from every joined table implicitly.
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll()
  .execute()
`,
    },
    {
      name: 'All columns of table',
      orchid: `import { db } from './tables';

const persons = await db.person
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll('person')
  .execute()
`,
    },
    {
      name: 'Nested array',
      text: `
        Because of using <code>JOIN LATERAL</code> under the hood, you can change <code>q.pets</code> in the example to <code>q.join().pets</code>
        to filter out results without pets.
      `,
      orchid: `import { db } from './tables';

const result = await db.person.select('id', {
  pets: (q) => q.pets.select('name', {
    petId: 'id',
  })
})
`,
      kysely: `import { db } from './tables';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

const result = await db
  .selectFrom('person')
  .select((eb) => [
    'id',
    jsonArrayFrom(
      eb.selectFrom('pet')
        .select(['pet.id as pet_id', 'pet.name'])
        .whereRef('pet.owner_id', '=', 'person.id')
        .orderBy('pet.name')
    ).as('pets')
  ])
  .execute()
`,
    },
    {
      name: 'Nested object',
      text: `
        As well as when selecting many, you can change <code>q.pets</code> in the example to <code>q.join().pets</code>
        to filter out results without a pet.
      `,
      orchid: `import { db } from './tables';

const result = await db.person.select('id', {
  favoritePet: (q) =>
    q.pets
      .select('name', { petId: 'id' })
      .where({ isFavorite: true })
      .takeOptional()
})
`,
      kysely: `import { db } from './tables';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

const result = await db
  .selectFrom('person')
  .select((eb) => [
    'id',
    jsonObjectFrom(
      eb.selectFrom('pet')
        .select(['pet.id as pet_id', 'pet.name'])
        .whereRef('pet.owner_id', '=', 'person.id')
        .where('pet.is_favorite', '=', true)
    ).as('favorite_pet')
  ])
  .execute()
`,
    },
  ],
  Where: [
    {
      name: 'Simple where clause',
      text: `
        Different column types have different <code>where</code> helpers.
        TypeScript will complain if you try to use <code>gt</code> for a non-numeric column.
      `,
      orchid: `import { db } from './tables';

const person = await db.person
  .where({
    firstName: 'Jennifer',
    age: { gt: 40 }
  })
  .takeOptional()
`,
      kysely: `import { db } from './tables';

const person = await db
  .selectFrom('person')
  .selectAll()
  .where('first_name', '=', 'Jennifer')
  .where('age', '>', 40)
  .executeTakeFirst()
`,
    },
    {
      name: 'Where in',
      text: `Using a sub-query or a raw query for values is also supported.`,
      orchid: `import { db } from './tables';

const persons = await db.person
  .whereIn('id', [1, 2, 3])
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll()
  .where('id', 'in', [1, 2, 3])
  .execute()
`,
    },
    {
      name: 'Where in with multiple columns',
      text: `Using a sub-query or a raw query for values is also supported.`,
      orchid: `import { db } from './tables';

const persons = await db.person.whereIn(
  ['firstName', 'lastName'],
  [
    ['Jennifer', 'Aniston'],
    ['Arnold', 'Schwarzenegger'],
  ],
)
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll()
  .where(({ eb, refTuple, tuple }) => eb(
    refTuple('first_name', 'last_name'),
    'in',
    [
      tuple('Jennifer', 'Aniston'),
      tuple('Arnold', 'Schwarzenegger'),
    ]
  ))
  .execute()
`,
    },
    {
      name: 'Object filter',
      orchid: `import { db } from './tables';

const persons = await db.person.where({
  firstName: 'Jennifer',
  lastName: (q) => q.ref('firstName'),
});
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll()
  .where((eb) => eb.and({
    first_name: 'Jennifer',
    last_name: eb.ref('first_name')
  }))
  .execute()
`,
    },
    {
      name: 'Or where',
      text: `
        <code>whereOneOf</code> stands for "...<b>and</b> where one of the given is true",<br/>
        <code>orWhere</code> is for "...<b>or</b> where one of the given is true".
      `,
      orchid: `import { db } from './tables';

const persons = await db.person
  // 1. Using the \`whereOneOf\` method on the expression builder:
  .whereOneOf(
    { firstName: 'Jennifer' },
    { firstName: 'Sylvester' },
  )
  // 2. Chaining expressions using the \`orWhere\` method on the
  // created expressions:
  .where(q =>
    q.where({ lastName: 'Aniston' }).orWhere({ lastName: 'Stallone' })
  )
`,
      kysely: `import { db } from './tables';

const persons = await db
  .selectFrom('person')
  .selectAll()
  // 1. Using the \`or\` method on the expression builder:
  .where((eb) => eb.or([
    eb('first_name', '=', 'Jennifer'),
    eb('first_name', '=', 'Sylvester')
  ]))
  // 2. Chaining expressions using the \`or\` method on the
  // created expressions:
  .where((eb) =>
    eb('last_name', '=', 'Aniston').or('last_name', '=', 'Stallone')
  )
  .execute()
`,
    },
    {
      name: 'Conditional where calls',
      text: `
        It is a common use-case to filter a query by parameters that aren't required,
        so <b>OrchidORM</b> ignores <code>undefined</code> values to stay concise.

        <b>OrchidORM</b>'s builder is also immutable, you can do <code>query = query.where(...)</code> similarly to the <b>Kysely</b>'s example.
      `,
      orchid: `import { db } from './tables';

const firstName: string | undefined = 'Jennifer'
const lastName: string | undefined = 'Aniston'
const under18 = true
const over60 = true

const persons = await db.person
  .where({
    // undefineds are ignored
    firstName,
    lastName,
  })
  .whereOneOf(
    ...[
      under18 && { age: { lt: 60 } },
      over60 && { age: { gt: 60 } },
    ].filter(Boolean),
  );
`,
      kysely: `import { db } from './tables';

const firstName: string | undefined = 'Jennifer'
const lastName: string | undefined = 'Aniston'
const under18 = true
const over60 = true

let query = db
  .selectFrom('person')
  .selectAll()

if (firstName) {
  query = query.where('first_name', '=', firstName)
}

if (lastName) {
  query = query.where('last_name', '=', lastName)
}

if (under18 || over60) {
  // Conditional OR expressions can be added like this.
  query = query.where((eb) =>
    eb.or(
      [
        under18 && eb('age', '<', 18),
        over60 && eb('age', '>', 60)
      ].filter(Boolean)
    )
  )
}

const persons = await query.execute()
`,
    },
    {
      name: 'Complex where clause',
      text: `
        <code>whereExists</code> and <code>whereNotExists</code> methods can also accept arbitrary sub-queries.
      `,
      orchid: `import { db } from './tables';

const firstName = 'Jennifer'
const maxAge = 60

const persons = await db.person
  .whereOneOf({ firstName }, { age: { lt: maxAge } })
  .whereNotExists('pets')
`,
      kysely: `import { db } from './tables';

const firstName = 'Jennifer'
const maxAge = 60

const persons = await db
  .selectFrom('person')
  .selectAll('person')
  .where(({ eb, or, and, not, exists, selectFrom }) => and([
    or([
      eb('first_name', '=', firstName),
      eb('age', '<', maxAge)
    ]),
    not(exists(
      selectFrom('pet')
        .select('pet.id')
        .whereRef('pet.owner_id', '=', 'person.id')
    ))
  ]))
  .execute()
`,
    },
  ],
  Join: [
    {
      name: 'Simple inner join',
      text: `
        When joining multiple tables and selecting 'id', unlike <b>Kysely</b>, <b>OrchidORM</b> will add the table name to the selection so the database knows which table to select from.
      `,
      orchid: `import { db } from './tables';

const result = await db.person
  .join('pets')
  // id is resolved to person.id - no ambiguity
  .select('id', { petName: 'pets.name' })
`,
      kysely: `import { db } from './tables';

const result = await db
  .selectFrom('person')
  .innerJoin('pet', 'pet.owner_id', 'person.id')
  .select(['person.id', 'pet.name as pet_name'])
  // this would select id of a pet
  // .select(['id'])
  .execute()
`,
    },
    {
      name: 'Aliased inner join',
      orchid: `import { db } from './tables';

const result = await db.person
  .join((q) => q.pets.as('p'))
  .where({ 'p.name': 'Doggo' })
  
result[0]?.id // this is a person id
`,
      kysely: `import { db } from './tables';

const result = await db.selectFrom('person')
  .innerJoin('pet as p', 'p.owner_id', 'person.id')
  .where('p.name', '=', 'Doggo')
  .selectAll()
  .execute()
  
result[0]?.id // this is a pet id
`,
    },
    {
      name: 'Complex join',
      orchid: `import { db } from './tables';

// selects only persons
const result = await db.person.join('pets', (q) =>
  q
    .where({ name: 'Doggo' })
    .whereOneOf(
      { 'person.age': { gt: 10 } },
      { 'person.age': { lt: 10 } },
    ),
)
`,
      kysely: `import { db } from './tables';

// selects persons merged with pets with column collisions
const result = await db.selectFrom('person')
  .innerJoin(
    'pet',
    (join) => join
      .onRef('pet.owner_id', '=', 'person.id')
      .on('pet.name', '=', 'Doggo')
      .on((eb) => eb.or([
        eb('person.age', '>', 18),
        eb('person.age', '<', 100)
      ]))
  )
  .selectAll()
  .execute()
`,
    },
    {
      name: 'Subquery join',
      text: `
        <b>OrchidORM</b> favors implicit joins from select, as you can see in the "Select" section.
        <br/>
        Yet it has <code>join</code>, <code>leftJoin</code>, <code>fullJoin</code>, <code>joinLateral</code>
        that supports joining by simple values, relations, sub-queries, CTE tables.
      `,
      orchid: `import { db } from './tables';

const result = await db.person
  .join(
    db.pet.as('doggo')
      .select('name', { owner: 'ownerId' })
      .where({ name: 'Doggo' }),
    (q) => q.on('doggo.owner', 'person.id')
  )
  // 'doggo' will be selected to a nested object,
  // so that person columns won't conflict with pet's
  .select('id', 'doggo.*')
`,
      kysely: `import { db } from './tables';

const result = await db.selectFrom('person')
  .innerJoin(
    (eb) => eb
      .selectFrom('pet')
      .select(['owner_id as owner', 'name'])
      .where('name', '=', 'Doggo')
      .as('doggos'),
    (join) => join
      .onRef('doggos.owner', '=', 'person.id'),
  )
  .selectAll('doggos')
  .execute()
`,
    },
  ],
  Insert: [
    {
      name: 'Single row',
      text: `
        <code>insert</code> returns a count of inserted records by default.
        <br />
        <code>create</code> returns a full record by default.
      `,
      orchid: `import { db } from './tables';

// \`get\` returns a single value
const id = await db.person
  .get('id')
  .insert({
    firstName: 'Jennifer',
    lastName: 'Aniston',
    age: 40
  })
`,
      kysely: `import { db } from './tables';

const result = await db
  .insertInto('person')
  .values({
    first_name: 'Jennifer',
    last_name: 'Aniston',
    age: 40
  })
  .returning(['id'])
  .executeTakeFirst()
`,
    },
    {
      name: 'Multiple rows',
      text: `
        <code>insertMany</code> returns a count of inserted records by default.
        <br />
        <code>createMany</code> returns array of inserted records by default.
      `,
      orchid: `import { db } from './tables';

// \`pluck\` returns a flat array of values
const ids = await db.person.pluck('id').insertMany([
  {
    firstName: 'Jennifer',
    lastName: 'Aniston',
    age: 40
  },
  {
    firstName: 'Arnold',
    lastName: 'Schwarzenegger',
    age: 70,
  },
])
`,
      kysely: `import { db } from './tables';

await db
  .insertInto('person')
  .values([
    {
      first_name: 'Jennifer',
      last_name: 'Aniston',
      age: 40,
    },
    {
      first_name: 'Arnold',
      last_name: 'Schwarzenegger',
      age: 70,
    },
  ])
  .execute()
`,
    },
    {
      name: 'Returning data',
      text: `
        <code>select</code> acts as <code>returning</code> in <b>Kysely</b>.
        It can be placed before or after the insert.
      `,
      orchid: `import { db } from './tables';

const result = await db.person
  .select('id', { name: 'firstName' })
  .insert({
    firstName: 'Jennifer',
    lastName: 'Aniston',
    age: 40
  })
`,
      kysely: `import { db } from './tables';

const result = await db
  .insertInto('person')
  .values({
    first_name: 'Jennifer',
    last_name: 'Aniston',
    age: 40,
  })
  .returning(['id', 'first_name as name'])
  .executeTakeFirstOrThrow()
`,
    },
    {
      name: 'Complex values',
      text: `
        Callbacks in <code>create</code> and related methods can return a value, a sub-query, or a raw SQL expression.
      `,
      orchid: `import { db } from './tables';

const ani = "Ani"
const ston = "ston"

const result = await db.person.create({
  firstName: 'Jennifer',
  lastName: (q) => q.sql<string>\`concat(\${ani}, \${ston})\`,
  middleName: (q) => q.ref('firstName'),
  age: db.person.avg('age'),
})
`,
      kysely: `import { db } from './tables';
import { sql } from 'kysely'

const ani = "Ani"
const ston = "ston"

const result = await db
  .insertInto('person')
  .values(({ ref, selectFrom, fn }) => ({
    first_name: 'Jennifer',
    last_name: sql<string>\`>concat(\${ani}, \${ston})\`,
    middle_name: ref('first_name'),
    age: selectFrom('person')
      .select(fn.avg<number>('age').as('avg_age')),
  }))
  .executeTakeFirst()
`,
    },
    {
      name: 'Insert subquery',
      text: `
        <code>lit</code> in <b>Kysely</b> is for inserting values into the query without parameterizing,
        there is no clear use-case for this, so no such method in <b>OrchidORM</b>.
      `,
      orchid: `import { db } from './tables';

const count = await db.person.insertManyFrom(
  db.pet.select({
    firstName: 'pet.name',
    lastName: (q) => q.val('Petson'),
    age: (q) => q.val(7),
  })
)
`,
      kysely: `import { db } from './tables';

const result = await db.insertInto('person')
  .columns(['first_name', 'last_name', 'age'])
  .expression((eb) => eb
    .selectFrom('pet')
    .select((eb) => [
      'pet.name',
      eb.val('Petson').as('last_name'),
      eb.lit(7).as('age'),
    ])
  )
  .execute()
`,
    },
  ],
  Update: [
    {
      name: 'Single row',
      text: `
        <code>update</code> returns a count of updated records by default,
        you can use <code>select</code>, <code>get</code>, and others for selecting data from an update.
      `,
      orchid: `import { db } from './tables';

const count = await db.person.find(1).update({
  firstName: 'Jennifer',
  lastName: 'Aniston',
})
`,
      kysely: `import { db } from './tables';

const result = await db
  .updateTable('person')
  .set({
    first_name: 'Jennifer',
    last_name: 'Aniston'
  })
  .where('id', '=', 1)
  .executeTakeFirst()
`,
    },
    {
      name: 'Complex values',
      text: `
        <code>increment</code> and <code>decrement</code> act on SQL level in the same way as <code>eb('age', '+', 1)</code> does in <b>Kysely</b>.
      `,
      orchid: `import { db } from './tables';

const count = await db.person.find(1)
  .increment('age')
  .update({
    firstName: db.pet.get('name'),
    lastName: 'updated',
  })
`,
      kysely: `import { db } from './tables';

const result = await db
  .updateTable('person')
  .set((eb) => ({
    age: eb('age', '+', 1),
    first_name: eb.selectFrom('pet').select('name').limit(1),
    last_name: 'updated',
  }))
  .where('id', '=', 1)
  .executeTakeFirst()
`,
    },
  ],
  Delete: [
    {
      name: 'Single row',
      text: `
        <code>delete</code> returns a count of deleted records by default,
        you can use <code>select</code>, <code>get</code>, and others for selecting data from a deletion.
      `,
      orchid: `import { db } from './tables';

const count = await db.person.find(1).delete()
`,
      kysely: `import { db } from './tables';

const result = await db
  .deleteFrom('person')
  .where('person.id', '=', 1)
  .executeTakeFirst()
`,
    },
  ],
  Transactions: [
    {
      name: 'Simple transaction',
      text: `
        It is a common mistake to forget using <code>trx</code> object instead of <code>db</code>,
        so <b>OrchidORM</b> will pick up the transaction instance automatically for all the queries inside the transaction,
        by using <a href="https://nodejs.org/api/async_context.html#asynchronous-context-tracking">AsyncLocalStorage</a>.
        
        Related records can be created in a nested way, in that case, a transaction is issued automatically.
      `,
      orchid: `import { db } from './tables';

const catto = await db.$transaction(async () => {
  const ownerId = await db.person.get('id').create({
    firstName: 'Jennifer',
    lastName: 'Aniston',
    age: 40,
  })

  return await db.pet.create({
    ownerId,
    name: 'Catto',
    species: 'cat',
    isFavorite: false,
  })
})

const catto2 = await db.pet.create({
  owner: {
    create: {
      firstName: 'Jennifer',
      lastName: 'Aniston',
      age: 40,
    },
  },
  name: 'Catto',
  species: 'cat',
  isFavorite: false,
})
`,
      kysely: `import { db } from './tables';

const catto = await db.transaction().execute(async (trx) => {
  const jennifer = await trx.insertInto('person')
    .values({
      first_name: 'Jennifer',
      last_name: 'Aniston',
      age: 40,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  return await trx.insertInto('pet')
    .values({
      owner_id: jennifer.id,
      name: 'Catto',
      species: 'cat',
      is_favorite: false,
    })
    .returningAll()
    .executeTakeFirst()
})
`,
    },
  ],
  CTE: [
    {
      name: 'Simple selects',
      text: `
        Recursive CTEs are supported as well, see <a href="/guide/advanced-queries.html#withrecursive">withRecursive</a>.
      `,
      orchid: `import { db } from './tables';

const result = await db.$queryBuilder
  .with('jennifers',
    db.person
      .where({ firstName: 'Jennifer' })
      .select('id', 'age')
  )
  .with('adult_jennifers', (q) =>
    q.from('jennifers')
      .where({ age: { gt: 18 } })
  )
  .from('adult_jennifers')
  .where({ age: { lt: 60 } })
`,
      kysely: `import { db } from './tables';

const result = await db
  .with('jennifers', (db) => db
    .selectFrom('person')
    .where('first_name', '=', 'Jennifer')
    .select(['id', 'age'])
  )
  .with('adult_jennifers', (db) => db
    .selectFrom('jennifers')
    .where('age', '>', 18)
    .select(['id', 'age'])
  )
  .selectFrom('adult_jennifers')
  .where('age', '<', 60)
  .selectAll()
  .execute()
`,
    },
    {
      name: 'Inserts, updates, and deletions',
      orchid: `import { db } from './tables';

const result = await db.$queryBuilder
  .with(
    'newPerson',
    db.person
      .insert({
        firstName: 'Jennifer',
        age: 35,
      })
      .select('id')
  )
  .with('newPet', (q) =>
    db.pet
      .insert({
        name: 'Doggo',
        species: 'dog',
        isFavorite: true,
        // Use the id of the person we just inserted.
        ownerId: () => q.from('newPerson').get('id'),
      })
      .select('id')
  )
  .from(['newPerson', 'newPet'])
  .select({
    personId: 'newPerson.id',
    petId: 'newPet.id',
  })
`,
      kysely: `import { db } from './tables';

const result = await db
  .with('new_person', (db) => db
    .insertInto('person')
    .values({
      first_name: 'Jennifer',
      age: 35,
    })
    .returning('id')
  )
  .with('new_pet', (db) => db
    .insertInto('pet')
    .values({
      name: 'Doggo',
      species: 'dog',
      is_favorite: true,
      // Use the id of the person we just inserted.
      owner_id: db
        .selectFrom('new_person')
        .select('id')
    })
    .returning('id')
  )
  .selectFrom(['new_person', 'new_pet'])
  .select([
    'new_person.id as person_id',
    'new_pet.id as pet_id'
  ])
  .execute()
`,
    },
  ],
};
