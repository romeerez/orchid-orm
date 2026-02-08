---
outline: deep
---

# Advanced query methods

## with

[//]: # 'has JSDoc'

Use `with` to add a Common Table Expression (CTE) to the query.

`with` can be chained to any table on `db` instance, or to `db.$qb`,
note that in the latter case it won't have customized column types to use for typing SQL.

```ts
import { sql } from './base-table';

// can access custom columns when using off a table
db.anyTable.with('x', (q) =>
  q.select({ column: (q) => sql`123`.type((t) => t.customColumn()) }),
);

// only default columns are available when using off `$qb`
db.$qb.with('x', (q) =>
  q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
);
```

`with` accepts query objects, callbacks returning query objects, and custom SQL expressions returned from callbacks.

```ts
import { sql } from './base-table';

db.table
  .with(
    'alias',
    // define CTE by building a query
    db.table.select('one', 'two', 'three').where({ x: 123 }),
  )
  .from('alias')
  .select('one')
  .where({ two: 123 });

// 2nd argument can be a callback accepting a query builder
db.table
  .with('alias', (q) =>
    // select a custom sql
    q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
  )
  .from('alias')
  .select('column')
  .where({ column: 123 });

// 2nd argument can be used for options
db.table
  .with(
    'alias',
    {
      // all parameters are optional
      materialized: true,
      notMaterialized: true,
    },
    db.table,
  )
  .from('alias');
```

One `WITH` expression can reference the other:

```ts
db.$qb
  .with('a', db.table.select('id', 'name'))
  .with('b', (q) => q.from('a').where({ key: 'value' }))
  .from('b');
```

Defined `WITH` expression can be used in `.from` or `.join` with all the type safeness:

```ts
db.table.with('alias', db.table).from('alias').select('alias.id');

db.firstTable
  .with('secondTable', db.secondTable)
  .join('secondTable', 'secondTable.someId', 'firstTable.id')
  .select('firstTable.column', 'secondTable.column');
```

### withRecursive

[//]: # 'has JSDoc'

It is priceless for fetching tree-like structures, or any other recursive cases.

For example, it is useful for loading a tree of categories, where one category can include many other categories.

Similarly to [with](#with), `withRecursive` can be chained to any table or `db.$qb`.

For the first example, consider the employee table, an employee may or may not have a manager.

```ts
class Employee extends BaseTable {
  readonly table = 'employee';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    managerId: t.integer().nullable(),
  }));
}
```

The task is to load all subordinates of the manager with the id 1.

```ts
db.$qb
  .withRecursive(
    'subordinates',
    // the base, anchor query: find the manager to begin recursion with
    db.employee.select('id', 'name', 'managerId').find(1),
    // recursive query:
    // find employees whos managerId is id from the surrounding subordinates CTE
    (q) =>
      q
        .from(db.employee)
        .select('id', 'name', 'managerId')
        .join('subordinates', 'subordinates.id', 'profile.managerId'),
  )
  .from('subordinates');
```

As being shown, `withRecursive` accepts one query to begin with, and a second query in a callback that can reference the surrounding table expression "subordinates".

These two queries are joined with `UNION ALL` by default.

You can customize it by passing options after the name.

```ts
db.$qb
  .withRecursive(
    'subordinates',
    {
      // all parameters are optional
      union: 'UNION',
      materialized: true,
      notMaterialized: true,
    },
    // ...snip
  )
  .from('subordinates');
```

Recursive query can be constructed with basic SQL instructions only, without referencing other tables.
In the following example, we recursively select numbers from 1 to 100, and additionally apply n > 10 filter in the end.

```ts
import { sql } from './base-table';

db.$qb
  .withRecursive(
    't',
    // select `1 AS n` for the base query
    (q) => q.select({ n: (q) => sql`1`.type((t) => t.integer()) }),
    // select `n + 1 AS n` for the recursive part
    (q) =>
      q
        .from('t')
        // type can be omitted here because it was defined in the base query
        .select({ n: (q) => sql`n + 1` })
        .where({ n: { lt: 100 } }),
  )
  .from('t')
  .where({ n: { gt: 10 } });
```

### withSql

[//]: # 'has JSDoc'

Use `withSql` to add a Common Table Expression (CTE) based on a custom SQL.

Similarly to [with](#with), `withRecursive` can be chained to any table or `db.$qb`.

```ts
import { sql } from './base-table';

db.table
  .withSql(
    'alias',
    // define column types of the expression:
    (t) => ({
      one: t.integer(),
      two: t.string(),
    }),
    // define SQL expression:
    (q) => sql`(VALUES (1, 'two')) t(one, two)`,
  )
  // is not prefixed in the middle of a query chain
  .withSql(
    'second',
    (t) => ({
      x: t.integer(),
    }),
    (q) => sql`(VALUES (1)) t(x)`,
  )
  .from('alias');
```

Options can be passed via a second argument:

```ts
import { sql } from './base-table';

db.table
  .withSql(
    'alias',
    {
      // all parameters are optional
      recursive: true,
      materialized: true,
      notMaterialized: true,
    },
    (t) => ({
      one: t.integer(),
      two: t.string(),
    }),
    (q) => sql`(VALUES (1, 'two')) t(one, two)`,
  )
  .from('alias');
```

## withSchema

[//]: # 'has JSDoc'

Specifies the schema to be used as a prefix of a table name - only for a single query.

Normally, specify the schema in `orchidORM` config, or in the table class, see [table schema](/guide/orm-and-query-builder.html#table-schemas).

```ts
db.table.withSchema('customSchema').select('id');
```

Resulting SQL:

```sql
SELECT "user"."id" FROM "customSchema"."user"
```

## union, unionAll, intersect, intersectAll, except, exceptAll

[//]: # 'has JSDoc'

Creates a union query, takes one or more queries or SQL expressions.

```ts
import { sql } from './base-table';

// The first query of the union
db.one
  .select('id', 'name')
  // add two more queries to the union
  .union(
    db.two.select('id', 'name'),
    (q = sql`SELECT id, name FROM "thirdTable"`),
  )
  // sub-sequent `union` is equivalent to passing multiple queries into a single `union`
  .union(db.three.select('id', 'name'));
```

`order`, `limit`, `offset` are special, it matters if you place them **before** or **after** the `union`, it also have a meaning to place them before and after.

```ts
// order, limit, offset are applied ONLY to 'one'
db.one
  .order('x')
  .limit(1)
  .offset(1)
  // 'two' also has order, limit, and offset
  .unionAll(db.two.order('y').limit(2).offset(2))
  // sets order, limit, offset for all records
  .order('z')
  .limit(3)
  .offset(3);
```

Equivalent SQL:

```sql
-- both union parts have their own order, limit, offset
( SELECT * FROM one ORDER x ASC LIMIT 1 OFFSET 1 )
UNION ALL
( SELECT * FROM two ORDER y ASC LIMIT 2 OFFSET 2 )
-- order, limit, offset of the whole query
ORDER BY z ASC LIMIT 3 OFFSET 3
```

All the listed methods have the same signature, they are only different by SQL keyword:

- `union` - union of all queries, performs deduplication
- `unionAll` - `union` that allows duplicated rows
- `intersect` - get only rows that are present in all queries
- `intersectAll` - `intersect` that allows duplicated rows
- `except` - get only rows that are in the first query but not in the second
- `exceptAll` - `except` that allows duplicated rows

## getColumnInfo

[//]: # 'has JSDoc'

Returns an object with the column info about the current table, or an individual column if one is passed, returning an object with the following keys:

```ts
type ColumnInfo = {
  defaultValue: unknown; // the default value for the column
  type: string; // the column type
  maxLength: number | null; // the max length set for the column, present on string types
  nullable: boolean; // whether the column may be null
};

import { getColumnInfo } from 'orchid-orm';

// columnInfo has type Record<string, ColumnInfo>, where string is name of columns
const columnInfo = await getColumnInfo(db.table);

// singleColumnInfo has the type ColumnInfo
const singleColumnInfo = await getColumnInfo(db.table, 'name');
```

## copyTableData

[//]: # 'has JSDoc'

`copyTableData` is a function to invoke a `COPY` SQL statement, it can copy from or to a file or a program.

Copying from `STDIN` or to `STDOUT` is not supported.

It supports all the options of the `COPY` statement of Postgres. See details in [Postgres document](https://www.postgresql.org/docs/current/sql-copy.html).

The copying is performed by the Postgres database server, and it must have access to the file.

Type of copy argument:

```ts
export type CopyOptions<Column = string> = {
  columns?: Column[];
  format?: 'text' | 'csv' | 'binary';
  freeze?: boolean;
  delimiter?: string;
  null?: string;
  header?: boolean | 'match';
  quote?: string;
  escape?: string;
  forceQuote?: Column[] | '*';
  forceNotNull?: Column[];
  forceNull?: Column[];
  encoding?: string;
} & (
  | {
      from: string | { program: string };
    }
  | {
      to: string | { program: string };
    }
);
```

Example usage:

```ts
import { copyTableData } from 'orchid-orm';

await copyTableData(db.table, {
  columns: ['id', 'title', 'description'],
  from: 'path-to-file',
});
```
