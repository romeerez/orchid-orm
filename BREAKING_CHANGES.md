# Breaking changes

## orchid-orm 1.28.0

#### with

See the updated [with](https://orchid-orm.netlify.app/guide/advanced-queries.html#with) docs.

Previously, the same `with` method could accept `recursive` parameter, and it could accept custom SQL expressions.

Now the `with` is focused on queries, added new `withRecursive` method for recursive `WITH`, and `withSql` for SQL expressions.

#### union and similar methods

(similar methods are `unionAll`, `intersect`, `intersectAll`, `except`, `exceptAll`)

- previously they accepted optional boolean argument two wrap queries wrap parens, now they are always wrapped;
- they accepted array, now accepting variadic `...args` (one or more arguments);
- `order`, `limit`, `offset` now are gracefully handled for such queries, see [docs](https://orchid-orm.netlify.app/guide/advanced-queries#union-unionall-intersect-intersectall-except-exceptall).

## orchid-orm 1.27.10

`updateRaw` renamed to `updateSql` (for consistency)

## orchid-orm 1.27.2

`fn` query builder used to accept a column type as a parameter, now the column type is set by using the `type` method instead:

```ts
db.table.select({
  // BEFORE
  value: (q) => (q) =>
    q.fn<number>('sqrt', ['numericColumn'], {}, (t) => t.integer()),
  // AFTER
  value: (q) => (q) =>
    q.fn<number>('sqrt', ['numericColumn']).type((t) => t.integer()),
});
```

## orchid-orm 1.27.0

In snake case mode, `timestamps()`'s helper columns had hardcoded names `updated_at` and `created_at`.
Now, if you apply timestamp columns separately as shown below, they will use and snakerize a column name from the key:

```ts
class Table extends BaseTable {
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // will be `custom_created` in db
    customCreated: t.timestamps().createdAt,
    // will be `custom_updated` in db
    customUpdated: t.timestamps().updatedAt,
  }));
}
```

`timestampsSnakeCase` and `timestampsNoTzSnakeCase` helpers were removed in favor of manually naming timestamps as shown above.

## orchid-orm 1.26.3, rake-db 2.20.0

The `import` config was optional, because on some setups it can work without it.
Now it's required, because it is confusing when it does not work for your setup, so it is better to require it for all.

```ts
rakeDb(dbOptions, {
  import: (path) => import(path),
});
```

## orchid-orm 1.26.1

`onConflict` changes:

- `onConflictIgnore` is renamed to `onConflictDoNothing` (was closer to Knex, becomes closer to SQL).
- `onConflict(...).merge` no longer accepts a set for update, only columns for merging.
- New `onConflict(...).set`: use `set` for setting specific values instead of `merge` as it was previously.
- `onConflict(...).merge` now can also accept `{ except: string | string[] }` to merge all values except for specified.

## orchid-orm 1.26.0

Rework of table primary keys, indexes, foreign keys, and checks.

### Query builder

- [findBy](https://orchid-orm.netlify.app/guide/query-methods.html#findby) now will only accept unique sets of columns.
  It accepts columns of simple and composite primary key and columns of unique indexes.
  `findBy` was a shortcut for `where(...).take()`, so it was grabbing the first record for matching conditions.
  It was easy to miss out the fact that there are multiple matching records in the database, and you're receiving a randomly picked one.
  It accepted a partial set of columns, and TS couldn't catch the case if a key is missing (undefined), it was possible to pass empty object: `findBy({})`
  without realizing it.
- [onConflict](https://orchid-orm.netlify.app/guide/create-update-delete.html#onconflict):
  - `onConflict().ignore()` is changed to `onConflictIgnore()`, passing columns to it is optional as it was.
  - `onConflict().merge()` now requires columns of primary key or one of unique indexes.
  - `onConflict()` now can also accept a name of primary key or unique index, if it was defined in the table's code.

### `setColumns` in table definitions

```ts
export class Table extends BaseTable {
  readonly table = 'table';

  // BEFORE
  columns = this.setColumns((t) => ({
    a: t.integer().primaryKey({ name: 'pkey' }),
    b: t.integer().index({ name: 'index' })
    c: t.integer().foreignKey(() => OtherTable, 'id', { name: 'fkey' }),
    d: t.integer().index({ unique: true }),
    ...t.timestamps(),
    ...t.primaryKey(['a', 'b'], { name: 'compositePkey' }),
    ...t.index(['a', 'b'], { name: 'compositeIndex', ...otherOptions }),
    ...t.foreignKey(['a', 'b'], () => OtherTable, ['id', 'type'], { name: 'fkey2' }),
    ...t.check(t.sql`a != b`),
  }));

  // AFTER
  columns = this.setColumns(
    (t) => ({
      a: t.integer().primaryKey('pkey'),
      b: t.integer().index('index')
      c: t.integer().foreignKey(() => OtherTable, 'id', { name: 'fkey' }),
      d: t.integer().unique(),
      ...t.timestamps(),
    }),
    (t) => [
      t.primaryKey(['a', 'b'], 'compositePkey'),
      t.index(['a', 'b'], 'compositeIndex', { ...otherOptions }),
      t.foreignKey(['a', 'b'], () => OtherTable, ['id', 'type'], { name: 'fkey2' }),
      t.check(t.sql`a != b`),
    ],
  );
```

- Composite primary keys, indexes, foreign keys are moving to a separate function.
  Now their column arguments are type-checked.
- To define a database-level name of the primary key or index, previously it was passed in an object,
  now it's passed separately after a column list.
  This way the name can be inferred for later use in `onConflict`.
- Previously, `t.unique()` was a shortcut for `t.index({ unique: true })`.
  Now it's mandatory to use `t.unique()` for unique indexes because in this way ORM can infer what indexes are unique,
  for later use in `findBy` and `onConflict`.
- Foreign key's name still can be passed via object because there is no need for inferring it.
- `...t.timestamps()` are unchanged, goes into the first function.
- If there is only a single composite primary key or index, it can be returned without wrapping into an array:
  ```ts
  (t) => t.primaryKey(['a', 'b'], 'compositePkey'),
  ```

### Migrations

The same changes to primary keys, indexes, foreign keys also applies for migrations.
`createTable` now will accept a second function for these things.
As well as in the table's code, `name` of primary key and index becomes a standalone argument, `{ unique: true }` index option was removed in favor of `t.unique()`.

`changeTable` still accepts a single function for changes, as it can't type-check columns that aren't in this migration anyway.

## orchid-orm 1.25.0

The new and shiny migration from code generator is arrived ([docs](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#generate-migrations)),
and the previous generator of code from migrations was dropped (`appCodeUpdater` config in `rake-db`).

Generating code from migrations was an experiment, and it was quicker to implement, but that approach wasn't viable enough and had limitations.
