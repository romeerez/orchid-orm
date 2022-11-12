# Test factories

`Porm` ecosystem offers a library for setting up JavaScript objects, to use this objects in tests.

It is producing objects of the shape defined by your model columns.

Under the hood it is using [@anatine/zod-mock](https://github.com/anatine/zod-plugins/tree/main/packages/zod-mock)
to create and fill object with random values. Random values are produced by [faker.js](https://www.npmjs.com/package/@faker-js/faker).

```ts
import { createFactory } from 'porm-test-factory'
import { db } from '../path-to-db'

const userFactory = createFactory(db.user)

const user = userFactory.build()
// user is an object with random values, like:
// {
//   id: 89613,
//   name: 'Jackie Homenick',
//   password: 'MHDDzAPYHzuklCN',
// }

const createdUser = await userFactory.create()
// save user with random values to database
```

Both `build` and `create` methods will handle timestamp field in a special way:

If the record contains multiple timestamps (such as `createdAt` and `updatedAt`) the value will be equal for each field.
if you have columns configured for timestamps as numbers (`t.timestamp().asNumber()`) the fields will have equal numeric timestamp,
for the default `t.timestamp()` columns will have equal timestamp string, and equal `Date` object for timestamp as dates (`t.timestamp().asDate()`).

Each new generated object will have timestamp increased by 1 millisecond,
so creating a list of records and then testing a query which is ordered by timestamp should work just fine.

By default, all text columns will be limited to generate 1000 character long strings at most.
You can override the maximum limit by specifying `maxTextLength`:

```ts
import { createFactory } from 'porm-test-factory'
import { db } from '../path-to-db'

const userFactory = createFactory(db.user, {
  maxTextLength: 123
})
```

## setup

Install this library:

```sh
npm i porm-test-factory
```

Factory cannot be in same file as model, place it somewhere else, for example, you can have a file `src/utils/test-factories.ts` and have factories for all models in a one place.

## sequence

Internally the factory keeps a `sequence` number which is increased by 1 for each new record.

The sequence can be used when overriding field values with custom functions:

```ts
const records = factory.buildList(3, {
  id: (sequence) => sequence,
  email: (sequence) => `email-${sequence}@mail.com`,
})
```

In such way each record can have unique `id` and `email`.

Modern test frameworks such as `Jest` are running test suites in parallel,
and this can lead to situation when 2 test suites are trying to save record with the same `email-1@mail.com` email to the database.

This problem is handled specifically for `Jest` by using `process.env.JEST_WORKER_ID` env variable: if this var is defined,
`porm-test-factory` will start sequence from `(workerId - 1) * sequenceDistance + 1`, where `sequenceDistance` is 1000 by default.
In such way, first suite sequence will start from 1, second suite sequence will start from 1001, and so on.

`sequenceDistance` for the described equation can be overridden:

```ts
import { createFactory } from 'porm-test-factory'
import { db } from '../path-to-db'

const userFactory = createFactory(db.user, {
  sequenceDistance: 123456,
})
```

For other test frameworks which are running suites in parallel provide `sequence` manually when creating a factory:

```ts
import { createFactory } from 'porm-test-factory'
import { db } from '../path-to-db'

// use VITEST_POOL_ID for vitest framework, this env var behaves like JEST_WORKER_ID in jest
const workerId = parseInt(process.env.VITEST_POOL_ID as string)

const userFactory = createFactory(db.user, {
  sequence: (workerId - 1) * 1000 + 1,
})
```

## build

Build a new object with same structure as your model filled with random data:

```ts
import { createFactory } from 'porm-test-factory'
import { db } from '../path-to-db'

const userFactory = createFactory(db.user)

const user = userFactory.build()
```

Optionally you can pass a specific data to `build`:

```ts
const specificUser = userFactory.build({
  name: 'James',
  age: 30,
})
```

You can provide a function to generate new value:

```ts
const user = userFactory.build({
  randomNumber: () => Math.random(),
})
```

It's possible to provide an extra data, which is not defined by a Model columns:

```ts
const user = userFactory.build({
  customField: 'someValue'
})
```

## buildList

Build an array of objects, provide a number for how many objects needed:

```ts
const arrayOfUsers = userFactory.buildList(5)
```

Optional second argument is the same as in `build`:

```ts
const arrayOfCustomizedUsers = userFactory.build(5, {
  // each user in array will have own random number
  randomNumber: () => Math.random(),
})
```

## create

`create` is saving record to the database and returns result:

```ts
const user = await userFactory.create()
```

In the argument you can provide values for columns, functions to generate values,
and you can use all the nested create methods available for this model.

In contrast to `build`, additional properties are not allowed here, only the columns of the model.

`create` method will automatically look for serial primary keys in the model to omit it from being generated,
so the natural sequence of `t.serial().primaryKey()` columns will be preserved.

```ts
// create a user with profile (user hasOne profile) and genres (user hasMany genres)
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
    ]
  }
})
```

# createList

Create an array of records, provide a number for how many objects needed:

```ts
const users = await userFactory.createList(5)
```

Optional second argument is the same as in `create`:

```ts
const arrayOfCustomizedUsers = await userFactory.create(5, {
  // each user in array will have own random number
  randomNumber: () => Math.random(),
})
```

## omit

Omit some fields before building an object. Only for `build` method, `create` will ignore it.

```ts
const partialUser = await userFactory.omit({ id: true, name: true }).build()
// partialUser has everything except id and name
```

## pick

Pick specific fields before building an object. Only for `build` method, `create` will ignore it.

```ts
const partialUser = await userFactory.pick({ id: true, name: true }).build()
// partialUser has only id and name
```

## set

Set custom data before building or creating an object.

It takes the same argument as a `build`.

```ts
const user = userFactory.set({ name: 'Vasya' }).build()

const createdUser = await userFactory.set({ name: 'Vasya' }).create()
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

const userFactory = new UserFactory()

const user = userFactory.specificUser().build()
```

Methods can be chained:

```ts
const user = userFactory
  .pick({ id: true, name: true })
  .specificUser()
  .set({ key: 'value' })
  .build()
```
