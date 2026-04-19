---
outline: deep
description: ORM methods prefixed with $ including $query, $queryArrays, $withOptions, $getAdapter, $from, and $close.
---

# ORM Methods

`OrchidORM` exposes specific functions prefixed with a `$` sign to not overlap with your table names.

## $query

Use `$query` to perform raw SQL queries.

```ts
const value = 1;

// it is safe to interpolate inside the backticks (``):
const result = await db.$query<{ one: number }>`SELECT ${value} AS one`;
// data is inside `rows` array:
result.rows[0].one;
```

If the query is executing inside a transaction, it will use the transaction connection automatically.

```ts
await db.$transaction(async () => {
  // both queries will execute in the same transaction
  await db.$query`SELECT 1`;
  await db.$query`SELECT 2`;
});
```

Alternatively, provide a raw SQL object created with the `sql` function:

```ts
import { sql } from './base-table';

// it is NOT safe to interpolate inside a simple string, use `values` to pass the values.
const result = await db.$query<{ one: number }>(
  sql({
    raw: 'SELECT $value AS one',
    values: {
      value: 123,
    },
  }),
);

// data is inside `rows` array:
result.rows[0].one;
```

### $query.records

Returns an array of records:

```ts
const array: T[] = await db.$query.records<T>`SELECT * FROM table`;
```

### $query.take

Returns a single record, throws [NotFoundError](/guide/error-handling) if not found.

```ts
const one: T = await db.$query.take<T>`SELECT * FROM table LIMIT 1`;
```

### $query.takeOptional

Returns a single record or `undefined` when not found.

```ts
const maybeOne: T | undefined = await db.$query
  .takeOptional<T>`SELECT * FROM table LIMIT 1`;
```

### $query.rows

Returns array of tuples of the values:

```ts
const arrayOfTuples: [number, string][] = await db.$query.rows<
  [number, string]
>`SELECT id, name FROM table`;
```

### $query.pluck

Returns a flat array of values for a single column:

```ts
const strings: string[] = await db.$query.pluck<string>`SELECT name FROM table`;
```

### $query.get

Returns a single value, throws [NotFoundError](/guide/error-handling) if not found.

```ts
const value: number = await db.$query.get<number>`SELECT 1`;
```

### $query.getOptional

Returns a single value or `undefined` when not found.

```ts
const value: number | undefined = await db.$query.getOptional<number>`SELECT 1`;
```

## $queryArrays

Performs a SQL query, returns a db result with array of arrays instead of objects:

```ts
const value = 1;

// it is safe to interpolate inside the backticks (``):
const result = await db.$queryArrays<[number]>`SELECT ${value} AS one`;
// `rows` is an array of arrays:
const row = result.rows[0];
row[0]; // our value
```

## $withOptions

[//]: # 'has JSDoc'

`$withOptions` supports overriding `log`, `schema`, `role`, and `setConfig` for the duration of the callback.

### log and schema

- `log`: boolean, enables or disables logging in the scope of the callback.
- `schema`: set a **default** schema, note that it does not override
  if you already have a schema set in the ORM config or for a specific table.

```ts
await db.$withOptions({ log: true, schema: 'custom' }, async () => {
  // will log this query, and will use the custom schema for this table,
  // unless this table already has a configured schema.
  await db.table.find(123);
});
```

### role and setConfig (SQL session)

- `role`: string, switches the Postgres role for the duration of the callback.
  Used for row-level security (RLS) policies.
- `setConfig`: object with string, number, or boolean values, sets Postgres custom
  settings for the callback scope. Use dotted names like `app.tenant_id`.
  Values are normalized to strings internally.

```ts
await db.$withOptions(
  {
    role: 'app_user',
    setConfig: {
      'app.tenant_id': tenantId,
      'app.user_id': userId,
    },
  },
  async () => {
    // All queries in this callback run with the specified role and settings.
    // RLS policies can reference these settings with current_setting('app.tenant_id', true).
    const project = await db.project.find(projectId);
    return project;
  },
);
```

SQL session options apply to all Orchid queries including:

- Table queries (`db.table.find()`, `db.table.create()`, etc.)
- Raw query helpers (`db.$query`, `db.$queryArrays`)
- Relation follow-up queries
- Hook-triggered queries
- Batched executions

::: warning
**Nested SQL session scopes are not allowed.**

If an outer scope already has `role` or `setConfig`, attempting to set them again in a nested `$withOptions` call will throw an error.
If nested `role`/`setConfig` support would be useful for your case, please open an issue and describe your use case.

```ts
await db.$withOptions({ role: 'app_user' }, async () => {
  // This will throw an error because role is already set
  await db.$withOptions({ role: 'other_role' }, async () => {
    await db.table.find(123);
  });
});
```

Nested scopes that only change `log` or `schema` will inherit the outer SQL session context:

```ts
await db.$withOptions({ role: 'app_user' }, async () => {
  // This works: inherits role from outer scope
  await db.$withOptions({ log: true }, async () => {
    await db.table.find(123);
  });
});
```

:::

#### Middleware example for per-request session context

You can wrap every request in a middleware that sets SQL session config for the duration of request handling:

```ts
function setUserToDbSessionMiddleware(req, res, next) {
  return db.$withOptions(
    {
      setConfig: {
        'app.userId': req.userId,
      },
    },
    next,
  );
}
```

::: tip
**Explicit transactions inherit SQL session context.**

When you open a transaction inside a `$withOptions` callback, all queries in the transaction inherit the same role and config settings:

```ts
await db.$withOptions(
  {
    role: 'app_user',
    setConfig: { 'app.tenant_id': tenantId },
  },
  async () => {
    const project = await db.project.find(projectId);

    await db.$transaction(async () => {
      // This query runs in the transaction with the same role and config
      await db.project.find(projectId).update({ lastViewedAt: new Date() });
    });
  },
);
```

:::

::: warning
**Manual raw SQL session changes are outside the feature contract.**

Direct `SET ROLE`, `RESET ROLE`, or `set_config(...)` calls inside the callback may invalidate Orchid's internal view of session state. Use the `$withOptions` API for reliable SQL session management.
:::

## $getAdapter

[//]: # 'has JSDoc'

Adapter is a wrapper on top of `postgres-js`, `node-postgres`, or other db driver.

When in transaction, returns a db adapter object for the transaction,
returns a default adapter object otherwise.

Treat the adapter as implementation detail and avoid accessing it directly.

```ts
const adapter = db.$getAdapter();
```

## $from

Use `$from` to build a queries around sub queries similar to the following:

```ts
const subQuery = db.someTable.select('name', {
  relatedCount: (q) => q.related.count(),
});

const result = await db
  .$from(subQuery)
  .where({ relatedCount: { gte: 5 } })
  .limit(10);
```

It is the same [from](/guide/query-methods#from) method as available in the query builder, it also can accept multiple sources.

## $close

Call `$close` to end a database connection:

```ts
await db.$close();
```

For a standalone query builder, the method is `close`.
