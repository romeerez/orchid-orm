# ORM setup and overview

**Porm** stands for Postgres ORM, where ORM is an abstract interface to work with models and relations between them with ease and fun.

While `pqb` query builder is designed to cover abilities of [knex](https://knexjs.org) to allow building any possible queries, `porm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`porm` models are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here. For query methods see [query builder](/guide/query-builder) document.

## setup

Install by running:

```sh
npm i porm
```

`porm` is an entry function of the ORM.

First argument is a connection options object, for all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

Connection options may include `log` and `logger`, see [createDb](/guide/query-builder.html#createDb) for details.

Second argument is an object where keys are model names and values are models (see next section for defining model).

Returns instance with models and some specific functions prefixed with `$` sign to not overlap with your models.

```ts
import { porm } from 'porm'

// import all models
import { UserModel } from './models/user'
import { MessageModel } from './models/message'

export const db = porm({
  // in the format: postgres://user:password@localhost:5432/dbname
  connectionString: process.env.DATABASE_URL,
  log: true, // option for logging, false by default
}, {
  user: UserModel,
  message: MessageModel,
})
```

## defining a model

First need to create a base `Model` class to extend from, this code should be in a separate from `db` file:

```ts
import { createModel } from 'porm'
import { columnTypes } from 'pqb'

export const Model = createModel({ columnTypes })
```

This step is needed for case of customization of column types.

See [column types document](/guide/columns-overview.html#override-column-types) for details.

Models are defined as classes with two required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-overview) document for details).

```ts
// import Model from a file from previous step:
import { Model } from './model'

// export type of User object:
export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    ...t.timestamps(),
  }))
}
```

After defining model place it to main `db` file as in [setup](#setup) step:

```ts
import { UserModel } from './models/user'

export const db = porm(Adapter(options), {
  user: UserModel,
})
```

And now it's available for querying:

```ts
import { db } from './db'

const user = await db.user.findBy({ name: 'John' })
```

Don't use model classes directly, it won't work:
```ts
// error
await UserModel.findBy({ name: 'John' })
```

## $transaction

Use `.$transaction` to wrap multiple database modification queries into a single transaction.

First argument of callback is a copy of your main porm instance, but every model on it is patched to use a transaction.

```ts
const { someId, otherId } = await db.$transaction(async (db) => {
  await db.someModel.where(...conditions).update(...data)
  await db.anotherModel.where(...conditions).delete()
  const someId = await db.someModel.get('id').create(...data)
  const otherId = await db.otherModel.get('id').create(...data)
  
  return { someId, otherId }
})
```

Be careful to use `db` from the callback argument, and not the main instance.

```ts
// mistake: someModel won't use a transaction because argument was forgotten.
await db.$transaction(async () => {
  await db.someModel.create(...data)
})
```

## $close

Call `$clone` to end a database connection:

```ts
await db.$close()
```

## raw

When using `raw` in `select` you need to provide a callback returning type:

```ts
raw((t) => t.integer(), 'sql')
```

Since column types can be customized when creating a base model, use `raw` method from the `db.model` and it will have customized types:

```ts
const result = await db.someModel.select({
  rawValue: db.someModel.raw((t) => t.customTime(), 'sql')
})
```

For simplicity, when the `raw` is used in `where` or other method which doesn't affect on resulting type, you cah import it from `pqb`:

```ts
import { raw } from 'pqb'

const result = await db.someModel.where(
  raw('a = $1 AND b = $2', 'string', 123)
)
```
