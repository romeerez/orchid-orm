---
outline: deep
---

# Where 条件

## where

[//]: # 'has JSDoc'

构建 `WHERE` 条件：

```ts
import { sql } from './baseTable';

db.table.where({
  // 当前表的列
  name: 'John',

  // 可以指定表名，可以是连接表的名称
  'table.lastName': 'Johnsonuk',

  // 带有操作符的对象，查看 "列操作符" 部分以获取完整列表：
  age: {
    gt: 30,
    lt: 70,
  },

  // 列等于原始 SQL
  // 从你的 `BaseTable` 导入 `sql`
  column: sql`sql expression`,
  // 或使用 `(q) => sql` 达到相同效果
  column2: (q) => sql`sql expression`,

  // 以这种方式引用其他列：
  firstName: (q) => q.ref('lastName'),
});
```

多个 `where` 使用 `AND` 连接：

```ts
db.table.where({ foo: 'foo' }).where({ bar: 'bar' });
```

```sql
SELECT * FROM table WHERE foo = 'foo' AND bar = 'bar'
```

`undefined` 值会被忽略，因此你可以提供一个带有条件的部分对象：

```ts
type Params = {
  // 允许提供确切年龄，或小于或大于
  age?: number | { lt?: number; gt?: number };
};

const loadRecords = async (params: Params) => {
  // 如果 params 是一个空对象，这将加载所有记录
  const records = await db.table.where(params);
};
```

它支持一个子查询，该子查询选择一个值以与列进行比较：

```ts
db.table.where({
  // 比较一个表中的 `someColumn` 与另一个查询返回的 `column` 值。
  someColumn: db.otherTable.where(...conditions).get('column'),
});
```

`where` 可以接受其他查询并合并它们的条件：

```ts
const otherQuery = db.table.where({ name: 'John' });

db.table.where({ id: 1 }, otherQuery);
// 这将生成 WHERE "table"."id" = 1 AND "table"."name' = 'John'
```

`where` 支持原始 SQL：

```ts
db.table.where(sql`a = b`);
```

`where` 可以接受一个带有特定查询构建器的回调，其中包含所有 "where" 方法，例如 `where`、`orWhere`、`whereNot`、`whereIn`、`whereExists`：

```ts
db.table.where((q) =>
  q
    .where({ name: 'Name' })
    .orWhere({ id: 1 }, { id: 2 })
    .whereIn('letter', ['a', 'b', 'c'])
    .whereExists(Message, 'authorId', 'id'),
);
```

`where` 可以接受多个参数，条件使用 `AND` 连接：

```ts
db.table.where({ id: 1 }, db.table.where({ name: 'John' }), sql`a = b`);
```

### where 子查询

[//]: # 'has JSDoc'

`where` 处理一个特殊的回调，你可以查询一个关系以获取某个值并通过该值进行过滤。

它对于分面搜索非常有用。例如，帖子有标签，我们希望找到所有具有给定标签的帖子。

```ts
const givenTags = ['typescript', 'node.js'];

const posts = await db.post.where(
  (post) =>
    post.tags // 查询帖子的标签
      .whereIn('tagName', givenTags) // 标签名称在数组中
      .count() // 统计找到的标签数量
      .equals(givenTags.length), // 数量必须与数组长度完全相等
  // 如果帖子只有 `typescript` 标签但没有 `node.js`，它将被忽略
);
```

这将生成一个高效的 SQL 查询：

```sql
SELECT * FROM "post"
WHERE (
  SELECT count(*) = 3
  FROM "tag" AS "tags"
  WHERE "tag"."tagName" IN ('typescript', 'node.js')
    -- 通过 "postTag" 表将标签连接到帖子
    AND EXISTS (
      SELECT 1 FROM "postTag"
      WHERE "postTag"."postId" = "post"."id"
        AND "postTag"."tagId" = "tag"."id"
    )
)
```

在上面的示例中，我们使用了 `count()`，你也可以使用任何其他 [聚合方法](/zh-CN/guide/aggregate)，例如 [min](/zh-CN/guide/aggregate#min)、[max](/zh-CN/guide/aggregate#max)、[avg](/zh-CN/guide/aggregate#avg)。

`count()` 与 `equals` 链接以检查严格相等，也允许任何其他 [操作](#column-operators)，例如 `not`、`lt`、`gt`。

### where 特殊键

[//]: # 'has JSDoc'

传递给 `where` 的对象可以包含特殊键，每个键对应自己的方法，并接受与方法参数类型相同的值。

例如：

```ts
db.table.where({
  NOT: { key: 'value' },
  OR: [{ name: 'a' }, { name: 'b' }],
  IN: {
    columns: ['id', 'name'],
    values: [
      [1, 'a'],
      [2, 'b'],
    ],
  },
});
```

使用方法 [whereNot](#whereNot)、[orWhere](#orWhere)、[whereIn](#wherein) 替代这种方式更简洁，但在某些情况下，这种对象键方式可能更方便。

```ts
db.table.where({
  // 查看 .whereNot
  NOT: { id: 1 },
  // 可以是数组：
  NOT: [{ id: 1 }, { id: 2 }],

  // 查看 .orWhere
  OR: [{ name: 'a' }, { name: 'b' }],
  // 可以是数组：
  // 这将生成 id = 1 AND id = 2 OR id = 3 AND id = 4
  OR: [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }, { id: 4 }],
  ],

  // 查看 .in，键语法需要一个带有列和值的对象
  IN: {
    columns: ['id', 'name'],
    values: [
      [1, 'a'],
      [2, 'b'],
    ],
  },
  // 可以是数组：
  IN: [
    {
      columns: ['id', 'name'],
      values: [
        [1, 'a'],
        [2, 'b'],
      ],
    },
    { columns: ['someColumn'], values: [['foo', 'bar']] },
  ],
});
```

### whereSql

在 `WHERE` 语句中使用自定义 SQL 表达式：

```ts
db.table.whereSql`a = b`;
```

### whereOneOf

[//]: # 'has JSDoc'

`whereOneOf` 表示 "...**并且**其中一个为真"。

接受与 `where` 相同的参数。

```ts
db.table.where({ id: 1 }).whereOneOf({ color: 'red' }, { color: 'blue' });
```

```sql
SELECT * FROM table
WHERE id = 1 AND (color = 'red' OR color = 'blue')
```

注意每个参数中的列使用 `AND` 连接：

```ts
db.table.whereOneOf({ id: 1, color: 'red' }, { id: 2 });
```

```sql
SELECT * FROM table
WHERE (id = 1 AND color = 'red') OR (id = 2)
```

#### whereNotOneOf

[//]: # 'has JSDoc'

负向 [whereOneOf](#whereoneof)：

```ts
db.table.where({ id: 1 }).whereNotOneOf({ color: 'red' }, { color: 'blue' });
```

```sql
SELECT * FROM table
WHERE id = 1 AND NOT (color = 'red' OR color = 'blue')
```

### orWhere

[//]: # 'has JSDoc'

`orWhere` 表示 "...**或者**其中一个为真"。

接受与 `where` 相同的参数。

```ts
db.table.where({ id: 1, color: 'red' }).orWhere({ id: 2, color: 'blue' });
// 等价于：
db.table.orWhere({ id: 1, color: 'red' }, { id: 2, color: 'blue' });
```

```sql
SELECT * FROM table
WHERE (id = 1 AND color = 'red') OR (id = 2 AND color = 'blue')
```

### whereNot

[//]: # 'has JSDoc'

`whereNot` 接受与 `where` 相同的参数，
多个条件使用 `AND` 组合，
整个条件组使用 `NOT` 否定。

```ts
// 查找不同于红色的记录
db.table.whereNot({ color: 'red' });
// WHERE NOT color = 'red'
db.table.whereNot({ one: 1, two: 2 });
// WHERE NOT (one = 1 AND two = 2)
```

#### whereNotSql

[//]: # 'has JSDoc'

`whereNotSql` 是接受 SQL 表达式的 `whereNot` 版本：

```ts
db.table.whereNotSql`sql expression`;
```

#### orWhereNot

[//]: # 'has JSDoc'

`orWhereNot` 接受与 `orWhere` 相同的参数，并为每个条件添加 `NOT`，就像 `whereNot` 一样。

### whereIn

[//]: # 'has JSDoc'

`whereIn` 和相关方法用于 `IN` 操作符以检查是否包含在值列表中。

当与单列一起使用时，它的工作方式与 `in` 列操作符相同：

```ts
db.table.whereIn('column', [1, 2, 3]);
// 与以下相同：
db.table.where({ column: [1, 2, 3] });
```

`whereIn` 可以支持列元组，这是 `in` 操作符无法支持的：

```ts
db.table.whereIn(
  ['id', 'name'],
  [
    [1, 'Alice'],
    [2, 'Bob'],
  ],
);
```

它支持返回具有相同类型列的记录的子查询：

```ts
db.table.whereIn(['id', 'name'], OtherTable.select('id', 'name'));
```

它支持原始 SQL 表达式：

```ts
db.table.whereIn(['id', 'name'], sql`((1, 'one'), (2, 'two'))`);
```

当给定空值集时，`whereIn` 将解析为具有特殊行为的 [none](/zh-CN/guide/query-methods#none) 查询。

```ts
// 以下查询解析为 `none`：
db.table.where('id', []);
db.table.where(['id', 'name'], []);
db.table.where({ id: [] });
```

#### orWhereIn

[//]: # 'has JSDoc'

接受与 `whereIn` 相同的参数。
向查询添加一个以 `OR` 前缀的 `WHERE IN` 条件：

```ts
db.table.whereIn('a', [1, 2, 3]).orWhereIn('b', ['one', 'two']);
```

#### whereNotIn

[//]: # 'has JSDoc'

行为与 `whereIn` 相同，但使用 `NOT` 否定条件：

```ts
db.table.whereNotIn('color', ['red', 'green', 'blue']);
```

#### orWhereNotIn

[//]: # 'has JSDoc'

行为与 `whereIn` 相同，但为条件添加 `OR` 前缀并使用 `NOT` 否定：

```ts
db.table.whereNotIn('a', [1, 2, 3]).orWhereNoIn('b', ['one', 'two']);
```

### whereExists

[//]: # 'has JSDoc'

`whereExists` 用于支持 `WHERE EXISTS (query)` 子句。

此方法接受与 `join` 相同的参数，详细信息请参阅 [join](#join) 部分。

```ts
// 查找有账户的用户
// 如果定义了关系名称，则通过关系名称查找
db.user.whereExists('account');

// 查找余额为正的账户的用户
// `accounts` 是关系名称
db.user.whereExists((q) => q.accounts.where({ balance: { gt: 0 } }));

// 使用表和连接条件查找
db.user.whereExists(db.account, 'account.id', 'user.id');

// 在回调中使用查询构建器查找：
db.user.whereExists(db.account, (q) => q.on('account.id', '=', 'user.id'));
```

#### orWhereExists

[//]: # 'has JSDoc'

行为与 `whereExists` 相同，但为条件添加 `OR` 前缀：

```ts
// 查找有账户或个人资料的用户
// 假设用户定义了 `account` 和 `profile` 两个关系。
db.user.whereExist('account').orWhereExists('profile');
```

#### whereNotExists

[//]: # 'has JSDoc'

行为与 `whereExists` 相同，但使用 `NOT` 否定条件：

```ts
// 查找没有账户的用户
// 假设用户 `belongsTo` 或 `hasOne` 账户。
db.user.whereNotExist('account');
```

#### orWhereNotExists

[//]: # 'has JSDoc'

行为与 `whereExists` 相同，但为条件添加 `OR` 前缀并使用 `NOT` 否定：

```ts
// 查找没有账户或没有个人资料的用户
// 假设用户定义了 `account` 和 `profile` 两个关系。
db.user.whereNotExists('account').orWhereNotExists('profile');
```

## 列操作符

[//]: # 'has JSDoc'

`where` 参数可以接受一个对象，其中键是操作符的名称，值是其参数。

不同类型的列支持不同的操作符集。

所有列操作符都可以接受与列类型相同的值、子查询或原始 SQL 表达式：

```ts
db.table.where({
  numericColumn: {
    // 小于 5
    lt: 5,

    // 小于子查询返回的值
    lt: OtherTable.select('someNumber').take(),

    // 原始 SQL 表达式生成 WHERE "numericColumn" < "otherColumn" + 10
    lt: sql`"otherColumn" + 10`,
  },
});
```

这些操作符也可以作为函数链接到查询中，请参阅 [聚合函数](/zh-CN/guide/aggregate)。

### 通用操作符

以下操作符适用于任何类型的列：

- `equals`：`=` 操作符，它可能对比较列值与 JSON 对象有用；
- `not`：`!=`（即 `<>`）不等于操作符；
- `in`：`IN` 操作符，用于检查列值是否包含在值列表中。
  接受值数组、返回值列表的子查询或返回值列表的原始 SQL 表达式；
- `notIn`：`NOT IN` 操作符，接受与 `in` 相同的参数。

```ts
db.table.where({
  // 当搜索确切的 JSON 值时，这不起作用：
  jsonColumn: someObject,

  // 使用 `{ equals: ... }` 替代：
  jsonColumn: { equals: someObject },

  anyColumn: { not: value },

  column: {
    in: ['a', 'b', 'c'],

    // WHERE "column" IN (SELECT "column" FROM "otherTable")
    in: OtherTable.select('column'),

    in: sql`('a', 'b')`,
  },
});
```

### 数字和日期操作符

用于比较数字和日期：

- `lt`：`<`，小于；
- `lte`：`<=`，小于或等于；
- `gt`：`>`，大于；
- `gte`：`>=`，大于或等于；
- `between`：用于 `BETWEEN ... AND`，它是包含的，等价于 `value1 <= target AND target <= value2`。

数字类型（int、decimal、double precision 等）可以与数字进行比较，
日期类型（date、timestamp）可以与 `Date` 对象或 `Data.toISOString()` 格式化字符串进行比较。

```ts
db.table.where({
  // 适用于数字：
  numericColumn: {
    gt: 5,
    lt: 10,
  },

  // 也适用于日期、时间戳：
  date: {
    lte: new Date(),
    gte: new Date().toISOString(),
  },

  column: {
    // 简单值
    between: [1, 10],

    // 子查询和原始 SQL 表达式
    between: [OtherTable.select('column').take(), sql`2 + 2`],
  },
});
```

### 文本操作符

适用于 `text`、`varchar`、`string` 和 `json` 列。

`json` 存储为文本，因此它也具有文本操作符。使用 `jsonb` 类型获取 JSON 操作符。

接受字符串、返回字符串的子查询或原始 SQL 表达式以及其他操作符。

输入中的 `%` 和 `_` 字符会被转义，因此用户输入的数据不会影响搜索逻辑。

```ts
db.table.where({
  textColumn: {
    // WHERE "textColumn" LIKE '%string%'
    contains: 'string',
    // WHERE "textColumn" ILIKE '%string%'
    containsInsensitive: 'string',
    // WHERE "textColumn" LIKE 'string%'
    startsWith: 'string',
    // WHERE "textColumn" ILIKE 'string%'
    startsWithInsensitive: 'string',
    // WHERE "textColumn" LIKE '%string'
    endsWith: 'string',
    // WHERE "textColumn" ILIKE '%string'
    endsWithInsensitive: 'string',
  },
});
```

### JSONB 列操作符

JSON 函数仅适用于 `jsonb` 列，请注意 `json` 类型具有文本操作符。

你可以使用 [jsonPathQueryFirst](/zh-CN/guide/json.html#jsonpathqueryfirst) 按 JSON 值进行过滤，详细信息请点击链接。

值可以是任何类型，也可以从子查询或原始 SQL 表达式返回。

```ts
db.table.where((q) =>
  q.get('jsonbColumn').jsonPathQueryFirst('$.name').equals(value),
);
```

`jsonSupersetOf`：检查列值是否是提供值的超集。

例如，如果列具有 JSON `{ "a": 1, "b": 2 }` 且提供值为 `{ "a": 1 }`，则为真。

接受任何类型的值，或返回单个值的子查询，或原始 SQL 表达式。

```ts
db.table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  },
});
```

`jsonSubsetOf`：检查列值是否是提供值的子集。

例如，如果列具有 JSON `{ "a": 1 }` 且提供值为 `{ "a": 1, "b": 2 }`，则为真。

接受任何类型的值，或返回单个值的子查询，或原始 SQL 表达式。

```ts
db.table.where({
  jsonbColumn: {
    jsonSubsetOf: { a: 1 },
  },
});
```

### 数组操作符

- `has`：检查值是否包含在列表中；
- `hasEvery`：检查所有值是否包含在列表中；
- `containedIn`：检查数组列中的所有值是否存在于给定列表中；
- `hasSome`：检查是否至少有一个值包含在列表中，即检查数组是否重叠；
- `length`：按数组长度过滤，它可以接受简单值或带有 [数字操作符](#numeric-and-date-operators) 的对象。

```ts
db.table.where({
  arrayColumn: {
    // WHERE 1 = ANY("arrayColumn")
    has: 1,

    // WHERE "arrayColumn" @> ARRAY[1, 2]
    hasEvery: [1, 2]

    // WHERE "arrayColumn" <@ ARRAY[1, 2]
    containedIn: [1, 2]

    // WHERE "arrayColumn" && ARRAY[1, 2]
    hasSome: [1, 2]

    // WHERE COALESCE(array_length("arrayColumn", 1), 0) = 0
    // coalesce 是必需的，因为 array_length 对于空数组返回 NULL。
    length: 0,

    // WHERE COALESCE(array_length("arrayColumn", 1), 0) > 3
    length: {
      gt: 3,
    },
  },
});
```

## exists

[//]: # 'has JSDoc'

使用 `exists()` 检查是否至少有一个记录匹配条件。

如果有任何 `select` 语句，将会被丢弃。返回布尔值。

```ts
const exists: boolean = await db.table.where(...conditions).exists();
```
