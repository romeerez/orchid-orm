# JSON 函数

请注意，操作单个 JSON 值的 JSON 方法，例如 [jsonSet](#jsonSet)、[jsonInsert](#jsonInsert) 等，可以一个接一个地链式调用：

```ts
db.table.update({
  data: (q) =>
    q.get('data').jsonSet('foo', 1).jsonSet('bar', 2).jsonRemove('baz'),
});
```

## json

[//]: # 'has JSDoc'

将查询包装为选择单个 JSON 字符串的方式。
这样 JSON 编码在数据库端完成，应用程序无需将响应转换为 JSON。
在某些情况下，这可能对性能更有利。

```ts
// json 是一个可以直接作为响应发送的 JSON 字符串。
const json = await db.table.select('id', 'name').json();
```

## jsonPathQueryFirst

[//]: # 'has JSDoc'

使用 JSON 路径从 JSON 数据中选择一个值。

调用 [jsonb_path_query_first](https://www.postgresql.org/docs/current/functions-json.html) Postgres 函数。

可以通过 `{ type: (t) => t.columnType() }` 选项提供类型，默认类型为 `unknown`。

可选地接受 `vars` 和 `silent` 参数，详细信息请参阅 [Postgres 文档](https://www.postgresql.org/docs/current/functions-json.html)。

`type` 选项设置选择值时的输出类型，
同时它使特定操作符在 `where` 中可用，例如如果类型是文本可以应用 `contains`，如果类型是数字可以应用 `gt`。

```ts
// 从 JSON 数据中查询单个值，
// 由于提供了类型，字符串 JSON 值将被解析为 Date 对象。
const value = await db.table
  .get('data')
  .jsonPathQueryFirst('$.path.to.date', { type: (t) => t.date().asDate() });

// 在选择中使用
const records = await db.table.select({
  date: (q) =>
    q.get('data').jsonPathQueryFirst('$[*] ? (@ = key)', {
      type: (t) => t.integer(),
      // 定义 `vars` 和 `silent`
      vars: { key: 'key' },
      silent: true,
    }),
});

// 在 `where` 中使用
const filtered = await db.table.where((q) =>
  // 通过 `data` JSON 列的 `name` 属性过滤记录
  q.get('data').jsonPathQueryFirst('$.name').equals('name'),
);

// 在更新中使用
await db.table.find(id).update({
  // 使用 data 属性设置 `name` 列
  name: (q) =>
    q.get('data').jsonPathQueryFirst('$.name', { type: (t) => t.string() }),
});

// 过滤记录以包含 JSON 属性 "name" 中的 'word'
await db.table.where((q) =>
  q
    .get('data')
    .jsonPathQueryFirst('$.name', { type: (t) => t.string() })
    .contains('word'),
);
```

## jsonSet

[//]: # 'has JSDoc'

返回一个在给定路径设置了给定值的 JSON 值/对象/数组。
路径是访问值的键或键数组。

调用 [jsonb_set](https://www.postgresql.org/docs/current/functions-json.html) Postgres 函数。

它可以在单个 JSON 值的所有上下文中使用。

```ts
await db.table.find(id).update({
  data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], 'new value'),
});
```

## jsonReplace

与 [jsonSet](#jsonSet) 相同，但将 `jsonb_set` 的最后一个参数设置为 false，
因此此函数仅在 JSON 中的值已存在时生效。

```ts
await db.table.find(id).update({
  // 仅当 data.path.to.value 已定义时才更新
  data: (q) => q.get('data').jsonReplace(['path', 'to', 'value'], 'new value'),
});
```

## jsonInsert

[//]: # 'has JSDoc'

将值插入到 JSON 数组的给定位置并返回整个数组。
路径是访问值的键或键数组。

如果在给定路径存在值，则不会替换该值。

提供 `{ after: true }` 选项以在给定位置之后插入值。

调用 [jsonb_insert](https://www.postgresql.org/docs/current/functions-json.html) Postgres 函数。

它可以在单个 JSON 值的所有上下文中使用。

```ts
// 将数据 { tags: ['two'] } 的记录更新为 { tags: ['one', 'two'] }
await db.table.find(id).update({
  data: (q) => q.get('data').jsonInsert(['tags', 0], 'one'),
});

// 在 'two' 之后添加 'three'
await db.table.find(id).update({
  data: (q) => q.get('data').jsonInsert(['tags', 1], 'three', { after: true }),
});
```

## jsonRemove

[//]: # 'has JSDoc'

从 JSON 对象或数组中删除给定路径的值。
路径是访问值的键或键数组。

使用 [#-](https://www.postgresql.org/docs/current/functions-json.html) Postgres 操作符。

它可以在单个 JSON 值的所有上下文中使用。

```ts
// 记录的数据为 { tags: ['one', 'two'] }
// 删除第一个标签后，数据将变为 { tags: ['two'] }
const result = await db.table.find(id).update({
  data: (q) => q.get('data').jsonRemove(['tags', 0]),
});
```
