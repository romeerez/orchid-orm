# ORM

**Porm** stands for Postgres ORM, where ORM is an abstract interface to work with models and relations between them with ease and fun.

While `pqb` query builder is designed to cover abilities of [knex](https://knexjs.org) to allow building any possible queries, `porm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`porm` models are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here. For query methods see [query builder](/guide/query-builder) document.

## Setup

`porm` is an entry function of the ORM, it takes `Adapter` which is accepting the same options as [node-postgres](https://node-postgres.com/) library.

For all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool)

`porm` returns another function which takes object where keys are model names and values are models (see next section for defining model).

```ts
import { Adapter } from 'pqb'
import { porm } from 'porm'

// import all models
import { UserModel } from './models/user'
import { MessageModel } from './models/message'

export const db = porm(Adapter({
  // in the format: postgres://user:password@localhost:5432/dbname
  connectionString: process.env.DATABASE_URL
}))({
  user: UserModel,
  message: MessageModel,
})
```

## Model

Models are defined as classes with two required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-schema) document for details).

```ts
// export type of User object:
export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    updatedAt: t.timestamp(),
    createdAt: t.timestamp(),
  }))
}
```

After defining model place it to main `db` file as in [setup](#setup) step:

```ts
import { UserModel } from './models/user'

export const db = porm(Adapter(options))({
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

## Relations

Different kinds of relations available: `belongsTo`, `hasOne`, `hasMany` and `hasAndBelongsToMany`.

Two models can have relation with each other without circular dependency problems:

```ts
// user.model.ts
import { ProfileModel } from './profile.model'

export class UserModel {
  table = 'user'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
  
  relations = {
    profile: this.hasOne(() => ProfileModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}

// profile.model.ts
import { UserModel } from './user.model'

export class ProfileModel {
  table = 'profile'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
  }))

  relations = {
    profile: this.hasOne(() => UserModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```
