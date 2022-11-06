# Error handling

Error handling applies to `ORM` as well.
All errors thrown when performing queries are wrapped in the error class specific to concrete table/model.

Error class has the same properties as in error of `pg` module and additional properties described below:

```ts
try {
  await db.table.create(...data)
} catch (error) {
  if (error instanceof db.table.error) {
    // `isUnique` in case of unique violation error,
    // when the value of unique column already exists
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
  
  // rethow the error if it is not recognized
  throw error
}
```

Table/model specific error classes are extending common `QueryError` class.

You can use `QueryError` class for global error handling of the app:

```ts
import { QueryError } from 'pqb'

export const globalErrorHandler = (error: unknown) => {
  if (error instanceof QueryError) {
    // handle the error
  }
}
```
