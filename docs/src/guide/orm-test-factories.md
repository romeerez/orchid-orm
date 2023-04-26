# Test factories

`Orchid ORM` ecosystem offers a library for setting up JavaScript objects, to use these objects in tests.

It is producing objects of the shape defined by your table columns.

Under the hood, it is using [@anatine/zod-mock](https://github.com/anatine/zod-plugins/tree/main/packages/zod-mock)
to create and fill the object with random values. Random values are produced by [faker.js](https://www.npmjs.com/package/@faker-js/faker).

```ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const userFactory = createFactory(db.user);

const user = userFactory.build();
// user is an object with random values, like:
// {
//   id: 89613,
//   name: 'Jackie Homenick',
//   password: 'MHDDzAPYHzuklCN',
// }

const createdUser = await userFactory.create();
// save the user with random values to the database
```

Both `build` and `create` methods will especially handle the timestamp field:

If the record contains multiple timestamps (such as `createdAt` and `updatedAt`) the value will be equal for each field.
if you have columns configured for timestamps as numbers (`t.timestamp().asNumber()`) the fields will have an equal numeric timestamp,
for the default `t.timestamp()` columns will have equal timestamp string and equal `Date` object for timestamp as dates (`t.timestamp().asDate()`).

Each newly generated object will have a timestamp increased by 1 millisecond,
so creating a list of records and then testing a query that is ordered by timestamp should work just fine.

By default, all text columns will be limited to generate 1000-character long strings at most.
You can override the maximum limit by specifying `maxTextLength`:

```ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const userFactory = createFactory(db.user, {
  maxTextLength: 123,
});
```

## example

This example is extracted from [building a sample app](/guide/building-a-sample-app.html), you can find more tests examples in this doc.

Here were are using `build` to build parameters for a test request, and `create` to create records for testing how unique violations are handled.

```ts
export const userFactory = createFactory(db.user);

describe('registration', () => {
  const params = userFactory.pick({
    username: true,
    email: true,
    password: true,
  });

  it('should register a new user', async () => {
    // buid a new random user data:
    const data = params.build();

    // testRequest may be a wrapper around light-my-request, axios, supertest
    // perform a POST request to /users with the data:
    const res = await testRequest.post('/users', data);

    const json = res.json();

    // expect response to have the same data as we sent:
    expect(json).toMatchObject({
      username: data.username,
      email: data.email,
    });

    // expect database to have a newly registered user with proper fields:
    const savedUser = await db.user.findBy({ username: data.username });
    expect(savedUser).toMatchObject({
      username: data.username,
      email: data.email,
    });
  });

  it('should return error when username is taken', async () => {
    // build a new random user data:
    const data = params.build();

    // create a new user with a random data, but this specific username:
    await userFactory.create({ username: data.username });

    const res = await testRequest.post('/users', data);

    // expect response to be failed with a message:
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      message: 'Username is already taken',
    });
  });
});
```

## setup

Install this library:

```sh
npm i orchid-orm-test-factory
```

Factory cannot be in the same file as the table class, place it somewhere else, for example, you can have a file `src/utils/test-factories.ts` and have factories for all tables in one place.

## sequence

Internally the factory keeps a `sequence` number which is increased by 1 for each new record.

The sequence can be used when overriding field values with custom functions:

```ts
const records = factory.buildList(3, {
  id: (sequence) => sequence,
  email: (sequence) => `email-${sequence}@mail.com`,
});
```

In a such way, each record can have a unique `id` and `email`.

Modern test frameworks such as `Jest` are running test suites in parallel,
and this can lead to a situation when 2 test suites are trying to save a record with the same `email-1@mail.com` email to the database.

This problem is handled specifically for `Jest` by using the `process.env.JEST_WORKER_ID` env variable: if this var is defined,
`orchid-orm-test-factory` will start the sequence from `(workerId - 1) * sequenceDistance + 1`, where `sequenceDistance` is 1000 by default.
In such a way, the first suite sequence will start from 1, the second suite sequence will start from 1001, and so on.

`sequenceDistance` for the described equation can be overridden:

```ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const userFactory = createFactory(db.user, {
  sequenceDistance: 123456,
});
```

For other test frameworks which are running suites in parallel provide `sequence` manually when creating a factory:

```ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

// use VITEST_POOL_ID for vitest framework, this env var behaves like JEST_WORKER_ID in jest
const workerId = parseInt(process.env.VITEST_POOL_ID as string);

const userFactory = createFactory(db.user, {
  sequence: (workerId - 1) * 1000 + 1,
});
```

## build

Build a new object with the same structure as your table filled with random data:

```ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const userFactory = createFactory(db.user);

const user = userFactory.build();
```

Optionally you can pass specific data to `build`:

```ts
const specificUser = userFactory.build({
  name: 'James',
  age: 30,
});
```

You can provide a function to generate new value:

```ts
const user = userFactory.build({
  randomNumber: () => Math.random(),
});
```

It's possible to provide extra data, which is not defined by table columns:

```ts
const user = userFactory.build({
  customField: 'someValue',
});
```

## buildList

Build an array of objects, and provide a number for how many objects are needed:

```ts
const arrayOfUsers = userFactory.buildList(5);
```

The optional second argument is the same as in `build`:

```ts
const arrayOfCustomizedUsers = userFactory.build(5, {
  // each user in the array will have their random number
  randomNumber: () => Math.random(),
});
```

## create

`create` is saving record to the database and returns the result:

```ts
const user = await userFactory.create();
```

In the argument, you can provide values for columns, functions to generate values,
and you can use all the nested create methods available for this table.

In contrast to `build`, additional properties are not allowed here, only the columns of the table.

The `create` method will automatically look for identity and serial primary keys in the table to omit it from being generated,
so the natural sequence of `t.identity().primaryKey()` columns will be preserved.

```ts
// create a user with a profile (user hasOne profile) and genres (user hasMany genres)
const customizedUser = await userFactory.create({
  name: 'Mikael',
  age: () => 48,
  profile: {
    create: {
      bio: 'Eros Ramazzotti of Sweden',
    },
  },
  genres: {
    create: [
      {
        name: 'progressive metal',
      },
      {
        name: 'progressive rock',
      },
    ],
  },
});
```

# createList

Create an array of records, and provide a number for how many objects are needed:

```ts
const users = await userFactory.createList(5);
```

The optional second argument is the same as in `create`:

```ts
const arrayOfCustomizedUsers = await userFactory.create(5, {
  // each user in the array will have their random number
  randomNumber: () => Math.random(),
});
```

## unique columns

Test factory will prefix unique text columns with sequence, and it will use a sequence for unique numeric columns.

Example:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    text: t.text(5, 1000).unique(),
    email: t.text(3, 100).email().unique(),
    url: t.text(10, 200).url().unique(),
    number: t.integer().unique(),
    greaterThan10: t.integer().gt(10).unique(),
    greaterThanOrEqualTo10: t.integer().gte(10).unique(),
  }));
}

const db = createDb(
  {
    ...dbOptions,
  },
  {
    table: SomeTable,
  },
);

const factory = createFactory(db.table);

// sequence is starting from 1

// text columns are prefixed with sequence and a space:
factory.text; // '1 random text'

// email is prefixed with a sequence and a dash:
factory.email; // '1-random@email.com'

// URL is prefixed with https:// + sequence and a dash
factory.url; // 'https://1-random.url/'

// number is set to sequence
factory.number; // 1

// number with `.gt` is set to sequence + gt value
factory.greaterThan10; // 11

// number with `.gte` is set to sequence + gt value - 1
factory.greaterThan10; // 10
```

`.max` and `.length` text column methods are taken into account to not exceed the limit when prefixing the value.

## omit

Omit some fields before building an object. Only for the `build` method, `create` will ignore it.

```ts
const partialUser = await userFactory.omit({ id: true, name: true }).build();
// partialUser has everything except id and name
```

## pick

Pick specific fields before building an object. Only for the `build` method, `create` will ignore it.

```ts
const partialUser = await userFactory.pick({ id: true, name: true }).build();
// partialUser has only id and name
```

## set

Set custom data before building or creating an object.

It takes the same argument as a `build`.

```ts
const user = userFactory.set({ name: 'Vasya' }).build();

const createdUser = await userFactory.set({ name: 'Vasya' }).create();
```

## extend

It is possible to extend a factory with custom methods:

```ts
class UserFactory extends createFactory(db.user).extend() {
  specificUser(age: number) {
    // can call other methods
    return this.otherMethod().set({
      age,
      name: 'Specific name',
    });
  }
  otherMethod() {
    return this.set({ extra: true });
  }
}

const userFactory = new UserFactory();

const user = userFactory.specificUser().build();
```

Methods can be chained:

```ts
const user = userFactory
  .pick({ id: true, name: true })
  .specificUser()
  .set({ key: 'value' })
  .build();
```
