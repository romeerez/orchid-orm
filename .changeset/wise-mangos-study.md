---
'pqb': patch
'orchid-core': patch
'orchid-orm': patch
---

Improve query `column` method, add `ref` method

The `column` method was just good for referencing a table column, now it also can be chained with column operators
to construct SQL expressions.

The `column` method can only reference a current table's column,
new `ref` method can reference any available column in the current query.

```ts
await db.table.select({
  // select `("table"."id" = 1 OR "table"."name" = 'name') AS "one"`,
  // returns a boolean
  one: (q) =>
    q.sql<boolean>`${q.column('id')} = ${1} OR ${q.column('name')} = ${'name'}`,

  // selects the same as above, but by building a query
  two: (q) => q.column('id').equals(1).or(q.column('name').equals('name')),
});
```
