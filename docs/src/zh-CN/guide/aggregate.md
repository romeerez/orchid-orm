# 聚合函数

支持多种聚合函数（如 count、min、max、string_agg 等），并且可以调用自定义的聚合函数。

每个聚合函数都接受以下选项：

```ts
type AggregateOptions = {
  // 在函数调用中添加 DISTINCT。
  distinct?: boolean;

  // 在函数调用中设置的排序参数，与 .order() 的参数相同。
  order?: OrderArg | OrderArg[];

  // 在函数调用中设置的过滤条件，与 .where() 的参数相同。
  filter?: WhereArg;

  // 支持过滤条件的 OR 逻辑，与 .orWhere() 的参数相同。
  filterOr?: WhereArg[];

  // 添加 WITHIN GROUP SQL 语句。
  withinGroup?: boolean;

  // 定义 OVER 子句。
  // 可以是通过调用 .window() 方法定义的窗口名称，
  // 或者是与 .window() 方法接受的参数相同的对象。
  over?: WindowName | OverOptions;
};
```

在表上调用聚合函数将返回一个简单值：

```ts
const result: number = await db.table.count();
```

所有函数都可以在 `select` 回调中调用以选择聚合值：

```ts
// 如果没有记录，avg 可能为 null
const result: { count: number; avg: number | null }[] = await db.table.select({
  count: (q) => q.count(),
  avg: (q) => q.avg('price'),
});
```

它们可以在 [having](/zh-CN/guide/query-methods#having) 中使用：

```ts
db.table.having((q) => q.count().gte(10));
```

函数可以与[列操作符](/zh-CN/guide/where#column-operators)链接使用。
严格按照函数的返回类型，`count` 可以与 `gt` 链接，但不能与 `contains` 链接。

```ts
// 数值函数可以与 `gt`、`lt` 和其他数值操作符链接使用：
const bool = await db.table.sum('numericColumn').gt(5);

await db.table.select({
  someTitleContainsXXX: (q) => q.stringAgg('title').contains('xxx'),
  notAllBooleansAreTrue: (q) => q.boolAnd('booleanColumn').not(true),
});
```

多个聚合函数可以通过 `and` 或 `or` 连接使用，例如：

```ts
// SELECT count(*) > 5 AND "numericColumn" < 100 FROM "table"
const bool = await db.table
  .count()
  .gt(5)
  .and(db.table.sum('numericColumn').lt(100));

const { theSameBool } = await db.table.select({
  theSameBool: (q) => q.count().gt(5).and(q.sum('numericColumn').lt(100)),
});
```

## count

[//]: # 'has JSDoc'

使用 `count` 函数统计记录数：

```ts
// 统计所有记录：
const result: number = await db.table.count();

// 统计某列不为 NULL 的记录：
db.table.count('name');

// 查看上述选项：
db.table.count('*', aggregateOptions);

// 按城市分组选择人口统计
db.people
  .select('city', {
    population: (q) => q.count(),
  })
  .group('city');
```

## min

[//]: # 'has JSDoc'

获取指定数值列的最小值，返回数字或 `null`（如果没有记录）。

```ts
const result: number | null = await db.table.min(
  'numericColumn',
  aggregateOptions,
);

// 按产品类别分组选择最低产品价格
db.product
  .select('category', {
    minPrice: (q) => q.min('price'),
  })
  .group('category')
  .take();
```

## max

[//]: # 'has JSDoc'

获取指定数值列的最大值，返回数字或 `null`（如果没有记录）。

```ts
const result: number | null = await db.table.max(
  'numericColumn',
  aggregateOptions,
);

// 按产品类别分组选择最高产品价格
db.product
  .select('category', {
    maxPrice: (q) => q.max('price'),
  })
  .group('category')
  .take();
```

## sum

[//]: # 'has JSDoc'

获取指定数值列的值的总和，返回数字或 `null`（如果没有记录）。

```ts
const result: number | null = await db.table.sum(
  'numericColumn',
  aggregateOptions,
);

// 按年份分组选择员工工资总和
db.employee
  .select('year', {
    yearlySalaries: (q) => q.sum('salary'),
  })
  .group('year');
```

## avg

[//]: # 'has JSDoc'

获取数值列的平均值，返回数字或 `null`（如果没有记录）。

```ts
const result: number | null = db.table.avg('numericColumn', aggregateOptions);

// 选择电影评分的平均值
db.movie
  .select('title', {
    averageRating: (q) => q.avg('rating'),
  })
  .group('title');
```

## bitAnd

[//]: # 'has JSDoc'

按位 `and` 聚合，返回 `number` 或 `null`（如果没有记录）。

```ts
const result: number | null = db.table.bitAnd(
  'numericColumn',
  aggregateOptions,
);

// 按组选择 `bitAnd`
db.table
  .select('someColumn', {
    bitAnd: (q) => q.bitAnd('numericColumn'),
  })
  .group('someColumn');
```

## bitOr

[//]: # 'has JSDoc'

按位 `or` 聚合，返回 `number` 或 `null`（如果没有记录）。

```ts
const result: number | null = db.table.bitOr('numericColumn', aggregateOptions);

// 按组选择 `bitOr`
db.table
  .select('someColumn', {
    bitOr: (q) => q.bitOr('numericColumn'),
  })
  .group('someColumn');
```

## boolAnd

[//]: # 'has JSDoc'

使用 `and` 逻辑聚合布尔值，返回 `boolean` 或 `null`（如果没有记录）。

```ts
const result: boolean | null = db.table.boolAnd(
  'booleanColumn',
  aggregateOptions,
);

// 按组选择 `boolAnd`
db.table
  .select('someColumn', {
    boolAnd: (q) => q.boolAnd('booleanColumn'),
  })
  .group('someColumn');
```

## boolOr

[//]: # 'has JSDoc'

使用 `or` 逻辑聚合布尔值，返回 `boolean` 或 `null`（如果没有记录）。

```ts
const result: boolean | null = db.table.boolOr(
  'booleanColumn',
  aggregateOptions,
);

// 按组选择 `boolOr`
db.table
  .select('someColumn', {
    boolOr: (q) => q.boolOr('booleanColumn'),
  })
  .group('someColumn');
```

## every

[//]: # 'has JSDoc'

等同于 `boolAnd`。

## jsonAgg 和 jsonbAgg

[//]: # 'has JSDoc'

使用 `json_agg` 将值聚合到数组中。返回值数组或 `null`（如果没有记录）。

`jsonAgg` 的速度稍快，`jsonbAgg` 仅在 SQL 中应用 JSON 操作时更好。

```ts
const idsOrNull: number[] | null = db.table.jsonAgg('id', aggregateOptions);

const namesOrNull: string[] | null = db.table.jsonbAgg(
  'name',
  aggregateOptions,
);

// 按组选择 `jsonAgg`
db.table
  .select('someColumn', {
    jsonAgg: (q) => q.jsonAgg('anyColumn'),
  })
  .group('someColumn');
```

## jsonObjectAgg 和 jsonbObjectAgg

[//]: # 'has JSDoc'

构造 JSON 对象，键是提供的字符串，值可以是表列或原始 SQL 表达式，返回 `object` 或 `null`（如果没有记录）。

`jsonObjectAgg` 与 `jsonbObjectAgg` 的区别在于数据库中的内部表示，`jsonObjectAgg` 构造简单字符串的速度稍快。

```ts
import { TextColumn } from './string';

// 对象类型为 { nameAlias: string, foo: string } | null
const object = await db.table.jsonObjectAgg(
  {
    // 选择带别名的列
    nameAlias: 'name',
    // 选择带别名的原始 SQL
    foo: sql<string>`"bar" || "baz"`,
  },
  aggregateOptions,
);

// 选择聚合对象
db.table.select('id', {
  object: (q) =>
    q.jsonObjectAgg({
      nameAlias: 'name',
      foo: sql<string>`"bar" || "baz"`,
    }),
});
```

## stringAgg

[//]: # 'has JSDoc'

选择连接的字符串，返回字符串或 `null`（如果没有记录）。

```ts
const result: string | null = db.table.stringAgg(
  'name',
  ', ',
  aggregateOptions,
);

// 按某列分组选择连接的字符串
db.table
  .select('someColumn', {
    joinedNames: (q) => q.stringAgg('name', ', '),
  })
  .group('someColumn');
```

## xmlAgg

[//]: # 'has JSDoc'

连接 `xml` 列，返回 `string` 或 `null`（如果没有记录）。

```ts
const xml: string | null = await db.table.xmlAgg('xmlColumn', aggregateOptions);

// 按某列分组选择连接的 XML
db.table
  .select('someColumn', {
    joinedXMLs: (q) => q.xmlAgg('xml'),
  })
  .group('someColumn');
```
