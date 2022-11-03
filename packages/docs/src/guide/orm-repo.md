# Repository

Repositories in `Porm` is a nice feature which allows to decompose complex queries into smaller single-purpose ones,
reuse query parts.

Consider following example, imagine we have a User model, it has relation with `followers` to track if one user is following another.

When querying user for some kind of lists, we need id, name, picture and a boolean flag to know if this user is followed by current authorized user.

Also, we want to have search on users by checking if substring contains in `firstName` or `lastName`.

We can define a repository in such way:

```ts
import { createRepo } from 'porm'
import { raw, columnTypes } from 'pqb'
import { db } from '../path-to-db'
import { User } from './user.model'
import { followRepo } from './follow.repo'

export const userRepo = createRepo(db.user, {
  selectForList(q, currentUser: User) {
    return q.select('id', 'firstName', 'lastName', 'picture', {
      following: (q) => followRepo(q.followers).isFollowedBy(currentUser),
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
})
```

First argument of `createRepo` is a `db.user`, it will be used by default when using `userRepo` to perform queries with.

First argument of each method is a query of type `db.user` provided earlier,
the type of it is inferred and no need to specify explicitly.

When more arguments are needed, they should have a type.

Repositories can use all model features, such a sub queries on relations.

Note how `followRepo` is used inside of `following` callback, in such way one repository can use other to decouple responsibilities.

And then we can use this repo in other parts of our code:

```ts
const users = await userRepo
  .defaultSelect(currentUser)
  .search(query)
  .order({ createdAt: 'DESC' })
  .limit(20)
  .offset(20)
```

All methods became chainable, first argument `q` is injected automatically under the hood.

Type safety is still guaranteed, so `users` is an array of specific objects with id: number, firstName: string, following: boolean, etc.

Need to be careful when using repos inside of transactions:

```ts
await db.$transaction(async (db) => {
  // wrong: userRepo is using a main `db` by default
  await userRepo.search(query)
  // need to provide `db.user` explicitly:
  await userRepo(db.user).search(query)
})
```

Currently, it is not possible to use one method of same repo in another method due to TypeScript limitations.
