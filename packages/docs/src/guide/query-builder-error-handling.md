# Error handling

Error handling applies to `ORM` as well.

All errors thrown when performing queries are wrapped in the error class specific to the concrete table.

The errors thrown by this library have a property `cause` -
it is a nested error with a stack trace pointing to the place in your code that started the query.

Error class has the same properties as in error of the `pg` module and additional properties described below:

```ts
try {
  await db.table.create(...data)
} catch (error) {
  if (error instanceof db.table.error) {
    // `isUnique` in case of a unique violation error,
    // when the value of the unique column already exists
    if (error.isUnique) {
      // columns is an object with columns and booleans
      // use it to know which columns have failed uniqueness
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

Error classes on the table interface are extending the common `QueryError` class.

You can use the `QueryError` class for global error handling of the app:

```ts
import { QueryError } from 'pqb'

export const globalErrorHandler = (error: unknown) => {
  if (error instanceof QueryError) {
    // handle the error
  }
}
```
