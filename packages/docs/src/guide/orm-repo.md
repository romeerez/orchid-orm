# Repository

Repositories in `Orchid ORM` is a nice feature that allows decomposing complex queries into smaller single-purpose ones,
reuse query parts.

Consider the following example, imagine we have a User model, it has a relation with `followers` to track if one user is following another.

When querying the user for some kind of list, we need an id, name, picture, and a boolean flag to know if this user is followed by a current authorized user.

Also, we want to have a search on users by checking if the substring contains `firstName` or `lastName`.

We can define a repository in such ways:

```ts
import { createRepo } from 'orchid-orm'
import { columnTypes } from 'pqb'
import { db } from '../path-to-db'
import { User } from './user.model'
import { followRepo } from './follow.repo'

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectForList(q, currentUser: User) {
      return q.select('id', 'firstName', 'lastName', 'picture', {
        followed: (q) => followRepo(q.followers).isFollowedBy(currentUser),
      })
    },
    search(q, query: string) {
      return q.or({
          firstName: {
            containsInsensitive: query
          },
        },
        {
          lastName: {
            containsInsensitive: query
          },
        })
    },
  }
})
```

The first argument of `createRepo` is a `db.user`, it will be used by default when using `userRepo` to perform queries.

The first argument of each method of `queryMethods` is a query of type `db.user` provided earlier,
the type of it is inferred and no need to specify explicitly.

When more arguments are needed, they should have a type.

Repositories can use all model features, such as sub-queries on relations.

Note how `followRepo` is used inside of the `followed` callback, in a such way one repository can use another to decouple responsibilities.

And then we can use this repo in other parts of our code:

```ts
const users = await userRepo
  .defaultSelect(currentUser)
  .search(query)
  .order({ createdAt: 'DESC' })
  .limit(20)
  .offset(20)

// response returned from the repo is typed properly
users[0].followed // boolean
```

All methods became chainable, first argument `q` is injected automatically under the hood.

Type safety is still guaranteed, so `users` is an array of specific objects with id: number, firstName: string, following: boolean, etc.

Need to be careful when using repositories inside of transactions:

```ts
await db.$transaction(async (db) => {
  // wrong: userRepo is using a main `db` by default
  await userRepo.search(query)
  // need to provide `db.user` explicitly:
  await userRepo(db.user).search(query)
})
```

Currently, it is not possible to use one method of the same repo in another method due to TypeScript limitations,
but you can extract a function for this purpose:

```ts
const selectFollowing = (q: typeof db.user, currentUser: User) => {
  return q.select({
    following: (q) => followRepo(q.followers).isFollowedBy(currentUser),
  })
}

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectForList(q, currentUser: User) {
      return selectFollowing(
        q.select('id', 'firstName', 'lastName', 'picture'),
        currentUser,
      )
    },
    selectForView(q, currentUser: User) {
      return selectFollowing(
        q.select('id', 'firstName', 'lastName', 'picture', 'bio', 'someOtherFields'),
        currentUser,
      )
    },
  },
})
```

## Kinds of methods

Different scopes of methods are available:

```ts
export const repo = createRepo(db.model, {
  queryMethods: {
    queryMethod(q) {
      // q can be any query
      return q.select(...columns)
    }
  },
  queryOneMethods: {
    // q is a query which is searching for one record
    queryOneMethod(q) {
      return q.where(...conditions).update({
        relation: {
          // nested create is only available when searching for one record
          create: { ...relationData }
        }
      })
    },
  },
  queryWithWhereMethods: {
    // q has `where` conditions
    queryWithWhereMethod(q) {
      // .delete() method requires having `where`
      // to not delete all records by mistake
      return q.delete()
    }
  },
  queryOneWithWhereMethods: {
    // q is a query with `where` conditions which returns one record
    queryOneWithWhereMethods(q) {
      // .update() method requires having `where`
      // to not update all records by mistake
      return q.update({
        relation: {
          // nested create is only available when searching for one record
          create: { ...relationData }
        }
      })
    }
  },
  methods: {
    // no query parameter, a simple method
    simpleMethod(a: number, b: number) {
      return a + b
    },
  }
})
```

When using these methods, TypeScript will check if the query satisfies the method parameter:

```ts
// `queryMethods` is available for any kind of query
repo.queryMethod()

// TS error
repo.queryOneMethod()
// OK
repo.find(1).queryOneMethod()

// TS error
repo.queryWithWhereMethod()
// OK
repo.where(...conditions).queryWithWhereMethod()

// TS error
repo.queryOneWithWhereMethod()
// OK: find returns one and adds conditions
repo.find(1).queryWithWhereMethod()

// OK
repo.simpleMethod(1, 1)
```
