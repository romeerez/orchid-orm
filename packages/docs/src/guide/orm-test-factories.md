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

## setup

Install this library:

```sh
npm i porm-test-factory
```

Factory cannot be in same file as model, place it somewhere else, for example, you can have a file `src/utils/test-factories.ts` and have factories for all models in a one place.

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
