---
outline: deep
---

# 高级查询方法

## with

[//]: # 'has JSDoc'

使用 `with` 向查询中添加一个公共表表达式（CTE）。

`with` 可以链接到 `db` 实例上的任何表，或者链接到 `db.$queryBuilder`，需要注意的是，在后者的情况下，它将无法使用自定义列类型来为 SQL 提供类型支持。

```ts
import { sql } from './baseTable';

// 当从表中使用时，可以访问自定义列
db.anyTable.with('x', (q) =>
  q.select({ column: (q) => sql`123`.type((t) => t.customColumn()) }),
);

// 当从 `$queryBuilder` 使用时，仅默认列可用
db.$queryBuilder.with('x', (q) =>
  q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
);
```

`with` 接受查询对象、返回查询对象的回调以及从回调返回的自定义 SQL 表达式。

```ts
import { sql } from './baseTable';

db.table
  .with(
    'alias',
    // 通过构建查询定义 CTE
    db.table.select('one', 'two', 'three').where({ x: 123 }),
  )
  .from('alias')
  .select('one')
  .where({ two: 123 });

// 第二个参数可以是接受查询构建器的回调
db.table
  .with('alias', (q) =>
    // 选择一个自定义 SQL
    q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
  )
  .from('alias')
  .select('column')
  .where({ column: 123 });

// 第二个参数可以用于选项
db.table
  .with(
    'alias',
    {
      // 所有参数都是可选的
      materialized: true,
      notMaterialized: true,
    },
    db.table,
  )
  .from('alias');
```

一个 `WITH` 表达式可以引用另一个：

```ts
db.$queryBuilder
  .with('a', db.table.select('id', 'name'))
  .with('b', (q) => q.from('a').where({ key: 'value' }))
  .from('b');
```

定义的 `WITH` 表达式可以在 `.from` 或 `.join` 中使用，并具有所有类型安全性：

```ts
db.table.with('alias', db.table).from('alias').select('alias.id');

db.firstTable
  .with('secondTable', db.secondTable)
  .join('secondTable', 'secondTable.someId', 'firstTable.id')
  .select('firstTable.column', 'secondTable.column');
```

### withRecursive

[//]: # 'has JSDoc'

对于获取树状结构或任何其他递归情况来说，它是无价的。

例如，它对于加载类别树非常有用，其中一个类别可以包含许多其他类别。

与 [with](#with) 类似，`withRecursive` 可以链接到任何表或 `db.$queryBuilder`。

在第一个示例中，考虑员工表，一个员工可能有也可能没有经理。

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

任务是加载 ID 为 1 的经理的所有下属。

```ts
db.$queryBuilder
  .withRecursive(
    'subordinates',
    // 基础锚点查询：找到经理以开始递归
    Employee.select('id', 'name', 'managerId').find(1),
    // 递归查询：
    // 找到 managerId 是周围 subordinates CTE 的 id 的员工
    (q) =>
      q
        .from(Employee)
        .select('id', 'name', 'managerId')
        .join('subordinates', 'subordinates.id', 'profile.managerId'),
  )
  .from('subordinates');
```

如所示，`withRecursive` 接受一个查询作为起点，以及一个可以引用周围表表达式 "subordinates" 的回调中的第二个查询。

这两个查询默认通过 `UNION ALL` 连接。

您可以通过在名称后传递选项进行自定义。

```ts
db.$queryBuilder
  .withRecursive(
    'subordinates',
    {
      // 所有参数都是可选的
      union: 'UNION',
      materialized: true,
      notMaterialized: true,
    },
    // ...snip
  )
  .from('subordinates');
```

递归查询可以仅使用基本 SQL 指令构造，而无需引用其他表。
在以下示例中，我们递归选择从 1 到 100 的数字，并在最后额外应用 n > 10 的过滤器。

```ts
import { sql } from './baseTable';

db.$queryBuilder
  .withRecursive(
    't',
    // 为基础查询选择 `1 AS n`
    (q) => q.select({ n: (q) => sql`1`.type((t) => t.integer()) }),
    // 为递归部分选择 `n + 1 AS n`
    (q) =>
      q
        .from('t')
        // 类型可以在这里省略，因为它已在基础查询中定义
        .select({ n: (q) => sql`n + 1` })
        .where({ n: { lt: 100 } }),
  )
  .from('t')
  .where({ n: { gt: 10 } });
```

### withSql

[//]: # 'has JSDoc'

使用 `withSql` 添加基于自定义 SQL 的公共表表达式（CTE）。

与 [with](#with) 类似，`withRecursive` 可以链接到任何表或 `db.$queryBuilder`。

```ts
import { sql } from './baseTable';

db.table
  .withSql(
    'alias',
    // 定义表达式的列类型：
    (t) => ({
      one: t.integer(),
      two: t.string(),
    }),
    // 定义 SQL 表达式：
    (q) => sql`(VALUES (1, 'two')) t(one, two)`,
  )
  // 在查询链的中间不会被前缀
  .withSql(
    'second',
    (t) => ({
      x: t.integer(),
    }),
    (q) => sql`(VALUES (1)) t(x)`,
  )
  .from('alias');
```

选项可以通过第二个参数传递：

```ts
import { sql } from './baseTable';

db.table
  .withSql(
    'alias',
    {
      // 所有参数都是可选的
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

指定要用作表名前缀的模式。

尽管此方法可用于在构建查询时设置模式，
但最好在调用 `db(table, () => columns, { schema: string })` 时指定模式。

```ts
db.table.withSchema('customSchema').select('id');
```

生成的 SQL：

```sql
SELECT "user"."id" FROM "customSchema"."user"
```

## union, unionAll, intersect, intersectAll, except, exceptAll

[//]: # 'has JSDoc'

创建一个联合查询，接受一个或多个查询或 SQL 表达式。

```ts
import { sql } from './baseTable';

// 联合的第一个查询
db.one
  .select('id', 'name')
  // 向联合添加两个查询
  .union(
    db.two.select('id', 'name'),
    (q = sql`SELECT id, name FROM "thirdTable"`),
  )
  // 后续的 `union` 等效于将多个查询传递给单个 `union`
  .union(db.three.select('id', 'name'));
```

`order`、`limit`、`offset` 是特殊的，它们在 **union** 之前或之后的位置很重要，放置在之前和之后也有意义。

```ts
// order、limit、offset 仅应用于 'one'
db.one
  .order('x')
  .limit(1)
  .offset(1)
  // 'two' 也有 order、limit 和 offset
  .unionAll(db.two.order('y').limit(2).offset(2))
  // 为所有记录设置 order、limit 和 offset
  .order('z')
  .limit(3)
  .offset(3);
```

等效的 SQL：

```sql
-- 两个联合部分都有自己的 order、limit 和 offset
( SELECT * FROM one ORDER x ASC LIMIT 1 OFFSET 1 )
UNION ALL
( SELECT * FROM two ORDER y ASC LIMIT 2 OFFSET 2 )
-- 整个查询的 order、limit 和 offset
ORDER BY z ASC LIMIT 3 OFFSET 3
```

所有列出的方法具有相同的签名，它们仅在 SQL 关键字上有所不同：

- `union` - 所有查询的联合，执行去重
- `unionAll` - 允许重复行的 `union`
- `intersect` - 仅获取所有查询中存在的行
- `intersectAll` - 允许重复行的 `intersect`
- `except` - 仅获取第一个查询中存在但不在第二个查询中的行
- `exceptAll` - 允许重复行的 `except`

## getColumnInfo

[//]: # 'has JSDoc'

返回一个包含当前表的列信息的对象，或者如果传递了单个列，则返回一个包含以下键的对象：

```ts
type ColumnInfo = {
  defaultValue: unknown; // 列的默认值
  type: string; // 列类型
  maxLength: number | null; // 为列设置的最大长度，存在于字符串类型上
  nullable: boolean; // 列是否可以为 null
};

import { getColumnInfo } from 'orchid-orm';

// columnInfo 的类型为 Record<string, ColumnInfo>，其中 string 是列名
const columnInfo = await getColumnInfo(db.table);

// singleColumnInfo 的类型为 ColumnInfo
const singleColumnInfo = await getColumnInfo(db.table, 'name');
```

## copyTableData

[//]: # 'has JSDoc'

`copyTableData` 是一个用于调用 `COPY` SQL 语句的函数，它可以从文件或程序复制数据，也可以将数据复制到文件或程序。

不支持从 `STDIN` 或到 `STDOUT` 的复制。

它支持 Postgres 的 `COPY` 语句的所有选项。详细信息请参见 [Postgres 文档](https://www.postgresql.org/docs/current/sql-copy.html)。

复制由 Postgres 数据库服务器执行，必须能够访问文件。

复制参数的类型：

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

使用示例：

```ts
import { copyTableData } from 'orchid-orm';

await copyTableData(db.table, {
  columns: ['id', 'title', 'description'],
  from: 'path-to-file',
});
```
