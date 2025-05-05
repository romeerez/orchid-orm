# SQL 表达式

## sql

[//]: # 'has JSDoc'

当需要使用一段原始 SQL 时，可以使用从 `BaseTable` 文件导出的 `sql`，它也附加在查询对象上以方便使用。

在选择自定义 SQL 时，可以使用 `<generic>` 语法指定结果类型：

```ts
import { sql } from './baseTable';

const result: { num: number }[] = await db.table.select({
  num: sql<number>`random() * 100`,
});
```

如果希望解析结果，例如返回一个时间戳并希望将其解析为 `Date` 对象，可以通过以下方式提供列类型：

此示例假设 `timestamp` 列已使用 `asDate` 覆盖，如[覆盖列类型](/zh-CN/guide/columns-overview#override-column-types)中所示。

```ts
import { sql } from './baseTable';

const result: { timestamp: Date }[] = await db.table.select({
  timestamp: sql`now()`.type((t) => t.timestamp()),
});
```

在某些情况下，例如使用 [from](/zh-CN/guide/orm-and-query-builder#from)，通过回调设置列类型允许特殊的 `where` 操作：

```ts
const subQuery = db.someTable.select({
  sum: (q) => sql`$a + $b`.type((t) => t.decimal()).values({ a: 1, b: 2 }),
});

// `gt`, `gte`, `min`, `lt`, `lte`, `max` in `where`
// are allowed only for numeric columns:
const result = await db.$from(subQuery).where({ sum: { gte: 5 } });
```

许多查询方法都有一个以 `Sql` 结尾的版本，可以直接将 SQL 模板字面量传递给这些方法。
这些方法包括：`whereSql`、`whereNotSql`、`orderSql`、`havingSql`、`fromSql`、`findBySql`。

```ts
await db.table.whereSql`"someValue" = random() * 100`;
```

在模板字面量中插入值是完全安全的：

```ts
// get value from user-provided params
const { value } = req.params;

// SQL injection is prevented by a library, this is safe:
await db.table.whereSql`column = ${value}`;
```

在上述示例中，TS 无法检查表是否具有 `column` 列，或者是否有连接的表具有这样的列，这将导致错误。
相反，请使用 [column](/zh-CN/guide/sql-expressions#column) 或 [ref](/zh-CN/guide/sql-expressions#ref) 来引用列：

```ts
// ids will be prefixed with proper table names, no ambiguity:
db.table.join(db.otherTable, 'id', 'other.otherId').where`
  ${db.table.column('id')} = 1 AND
  ${db.otherTable.ref('id')} = 2
`;
```

SQL 可以通过简单的字符串传递，重要的是注意不要在其中插入值。

```ts
import { sql } from './baseTable';

// no interpolation is okay
await db.table.where(sql({ raw: 'column = random() * 100' }));

// get value from user-provided params
const { value } = req.params;

// this is NOT safe, SQL injection is possible:
await db.table.where(sql({ raw: `column = random() * ${value}` }));
```

要将值注入 `sql({ raw: '...' })` SQL 字符串，请在字符串中用 `$` 表示，并提供 `values` 对象。

使用 `$$` 提供列或/和表名（`column` 或 `ref` 更可取）。列名将被引用，因此不要手动引用它们。

```ts
import { sql } from './baseTable';

// get value from user-provided params
const { value } = req.params;

// this is SAFE, SQL injection are prevented:
await db.table.where(
  sql<boolean>({
    raw: '$$column = random() * $value',
    values: {
      column: 'someTable.someColumn', // or simply 'column'
      one: value,
      two: 123,
    },
  }),
);
```

总结：

```ts
import { sql } from './baseTable';

// simplest form:
sql`key = ${value}`;

// with resulting type:
sql<boolean>`key = ${value}`;

// with column type for select:
sql`key = ${value}`.type((t) => t.boolean());

// with column name via `column` method:
sql`${db.table.column('column')} = ${value}`;

// raw SQL string, not allowed to interpolate values:
sql({ raw: 'random()' });

// with resulting type and `raw` string:
sql<number>({ raw: 'random()' });

// with column name and a value in a `raw` string:
sql({
  raw: `$$column = $value`,
  values: { column: 'columnName', value: 123 },
});

// combine template literal, column type, and values:
sql`($one + $two) / $one`.type((t) => t.numeric()).values({ one: 1, two: 2 });
```

## column

[//]: # 'has JSDoc'

`column` references a table column, this can be used in raw SQL or when building a column expression.
Only for referencing a column in the query's table. For referencing joined table's columns, see [ref](#ref).

```ts
await db.table.select({
  // select `("table"."id" = 1 OR "table"."name" = 'name') AS "one"`,
  // returns a boolean
  one: (q) =>
    sql<boolean>`${q.column('id')} = ${1} OR ${q.column('name')} = ${'name'}`,

  // selects the same as above, but by building a query
  two: (q) => q.column('id').equals(1).or(q.column('name').equals('name')),
});
```

## ref

[//]: # 'has JSDoc'

`ref` is similar to [column](#column), but it also allows to reference a column of joined table,
and other dynamically defined columns.

```ts
import { sql } from './baseTable';

await db.table.join('otherTable').select({
  // select `("otherTable"."id" = 1 OR "otherTable"."name" = 'name') AS "one"`,
  // returns a boolean
  one: (q) =>
    sql<boolean>`${q.ref('otherTable.id')} = ${1} OR ${q.ref(
      'otherTable.name',
    )} = ${'name'}`,

  // selects the same as above, but by building a query
  two: (q) =>
    q
      .ref('otherTable.id')
      .equals(1)
      .or(q.ref('otherTable.name').equals('name')),
});
```

## fn

[//]: # 'has JSDoc'

`fn` allows to call an arbitrary SQL function.

For example, calling `sqrt` function to get a square root from some numeric column:

```ts
const q = await User.select({
  sqrt: (q) => q.fn<number>('sqrt', ['numericColumn']),
}).take();

q.sqrt; // has type `number` just as provided
```

If this is an aggregate function, you can specify aggregation options (see [Aggregate](/zh-CN/guide/aggregate)) via third parameter.

Use `type` method to specify a column type so that its operators such as `lt` and `gt` become available:

```ts
const q = await User.select({
  // Produces `sqrt("numericColumn") > 5`
  sqrtIsGreaterThan5: (q) =>
    q
      .fn('sqrt', ['numericColumn'])
      .type((t) => t.float())
      .gt(5),
}).take();

// Return type is boolean | null
// todo: it should be just boolean if the column is not nullable, but for now it's always nullable
q.sqrtIsGreaterThan5;
```
