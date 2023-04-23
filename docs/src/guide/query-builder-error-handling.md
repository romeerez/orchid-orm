# Error handling

`Orchid ORM` and a query builder `pqb` can throw errors of two classes (that you can import from 'orchid-orm'):

`OrchidOrmError` - can be exposed to user, for now only `NotFoundError` extends it.

`OrchidOrmInternalError` - should not be exposed, has several sub-classes:

- `QueryError` - wraps a database error, see [below](#database-error).
- `MoreThanOneRowError` - may be thrown by `upsert` and `orCreate` methods, as they expect 0 or 1 record to be found.
- `UnhandledTypeError` - internal error that must never happen, indicates a bug in the library.

## global error handling

When using `find`, `findBy`, `take`, `get`, the ORM will throw `NotFoundError` in case when record is not found.

This is the only ORM error that can be safely exposed to users.

Here is how centralized error handler may look like:

```ts
import { ZodError } from 'zod'
import { NotFoundError } from 'orchid-orm'

// generic error class that the code of your app will use to throw errors
export class AppError extends Error {
  constructor(message?: string) {
    super(message)
  }
}

// more specific error classes extends AppError
export class SomeSpecificError extends AppError {
  message = 'some specific error happened'
}

export const performSomeAction = () => {
  // when the error can be exposed to user, use AppError
  throw new AppError('Oops')
  
  // otherwise, a standard Error
  throw new Error('Internal error')
}

// express.js error handler
app.use((err, req, res, next) => {
  // log the error
  console.error(err)

  // instanceof AppError means that it can be exposed to user
  if (err instanceof AppError) {
    // client never cares about error status, let it be 400 for all kinds of AppError
    return res.status(400).send({
      error: err.message,
    })
  }
  
  // default message is: Record is not found
  if (err instanceof NotFoundError) {
    return res.status(400).send({
      error: err.message,
    })
  }

  // catch validation errors
  if (err instanceof ZodError) {
    return res.status(400).send({
      // serialize validation error somehow
    })
  }
  
  res.status(500).send('Something broke!')
})
```

::: info
Hint for express.js users:

It still doesn't support async error handling, so you have to install a package [like this](https://www.npmjs.com/package/express-async-errors),
or come up with a custom helper/wrapper to catch errors of async routes, or to write boilerplative try-catch in every route.

Or switch to a modern framework 😅
:::

## database error

Stack trace of query errors is pointing to the library internals, in addition they have a property `cause` -
it is a nested error with a stack trace pointing to the place in your code that started the query.

Error class has the same properties as in error of the `pg` module and some additional properties described below.

All errors thrown when performing queries are wrapped in the error class specific to the concrete table.

And all tables have a property `error` that you can use to determine if the error belongs to the table.

Imagine we are going to save a new user, and want to handle possible uniqueness violations.

We can perform 4 database queries for this:

- begin transaction (to avoid race conditions)
- query if such user already exists
- save a user
- end transaction

Or, instead, just one query is enough, we only need to handle the error:

```ts
try {
  await db.table.create(...data)
} catch (error) {
  if (error instanceof db.table.error) {
    // `isUnique` in case of a unique violation error,
    // when the value of the unique column already exists
    if (error.isUnique) {
      // columns have type { [column name]?: true }
      // use it to determine which columns have failed uniqueness
      if (error.columns.username) {
        throw new Error('Username is already taken')
      }
      if (error.columns.email) {
        throw new Error('Email is already taken')
      }
    }
  }
  
  // rethrow the error if it is not recognized
  throw error
}
```

Error classes on the table interface are extending the common `QueryError`,
it has all the same properties as `DatabaseError` from `pg`.
