# 列模式概览

列模式存储有关表列的信息，以实现类型安全的查询，并为查询添加额外功能。

注意，所有列默认**非空**，如需可空请使用 `.nullable()`。

## 列类型

每种列类型有特定的数据库类型、输入类型、输出类型和查询类型：

- **数据库类型**：用于迁移时添加特定类型的列，如 `integer`、`varchar`。
- **输入类型**：用于创建或更新记录时。
- **输出类型**：从数据库查询数据时返回的数据类型。
- **查询类型**：在 `where` 条件中用于该列的类型。

大多数情况下，输入、输出和查询类型相同，但有时会不同。

例如，`timestamp` 默认以字符串返回（可自定义），但创建或更新时可接受时间戳整数、字符串或 Date 对象。

```ts
// 获取表的第一条记录的 createdAt 字段
const createdAt: string = await db.someTable.get('createdAt');

await db.someTable.create({
  // Date 类型可以
  createdAt: new Date(),
});

await db.someTable.create({
  // ISO 格式字符串也可以
  createdAt: new Date().toISOString(),
});
```

timestamp 的查询类型为 `number | string | Date`，与输入类型一致。

你可以自定义输入类型以支持如 [dayjs](https://day.js.org/) 对象，
但查询类型保持不变，无法更改。

所有列类型在 `where` 条件中支持如下操作符：

值可以是与列类型相同的值、子查询或原始 SQL（使用 `sql` 函数）：

```ts
db.someTable.where({
  column: {
    equals: value,
    not: value,
    in: [value1, value2, value3],
    notIn: [value1, value2, value3],
  },
});
```

不同类型的列在 `where` 条件中支持不同操作：

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.string(),
    age: t.integer(),
  }));
}

// 查询该表时：
db.someTable.where({
  name: {
    // contains 仅用于字符串
    contains: 'x',
  },
  age: {
    // gte 仅用于数字
    gte: 18,
  },
});
```

## 自定义列类型

当你需要使用扩展中定义但未直接支持的类型时，可用 `type` 定义。

此时输入、输出及其它 TS 类型均为 `unknown`。

如需类型化，请参考 [asType](/zh-CN/guide/common-column-methods#asType)、[encode](/zh-CN/guide/common-column-methods#encode)、[decode](/zh-CN/guide/common-column-methods.html#decode)。

[//]: # 'TODO: 更好地解释这一点'

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    point: () => t.type('geography(point)'),
  }),
});
```

## 基于其他类型的自定义列类型

可以定义自定义列，用于特殊行为、特殊含义或作为别名。

例如，可以添加 `id` 列作为 `identity().primaryKey()` 或 `uuid().primaryKey()` 的别名：

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // 自增整数 ID：
    id: () => t.identity().primaryKey(),
    // 或 UUID：
    id: () => t.uuid().primaryKey(),
  }),
});
```

如需使用 [cuid2](https://github.com/paralleldrive/cuid2) 类型的 ID，可在 JS 端生成新值：

```ts
import { createId } from '@paralleldrive/cuid2';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    id() {
      return t
        .varchar(36)
        .primaryKey()
        .default(() => createId());
    },
  }),
});
```

之后可像使用内置类型一样在表中使用自定义列：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // 自定义列
    id: t.id(),
  }));
}
```

## 覆盖解析/编码

可以覆盖数据库返回的列的解析方式。

可在列上定义 `.encode` 用于创建或更新记录时转换值，
定义 `.parse` 用于解析数据库返回的值，
`.as` 可将该列的 TS 类型更改为其他类型，从而在 `where` 中支持不同的操作。

以下为覆盖 timestamp 输入和输出类型的示例。

验证 schema 可选，以下为未设置 `schemaConfig` 时更改 timestamp 输入输出类型：

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    timestamp() {
      return t
        .timestamp()
        .encode((input: number) => new Date(input))
        .parse((input) => new Date(input).getTime())
        .as(t.integer());
    },
  }),
});
```

如使用 Zod 或 Valibot 集成，可指定验证 schema：

```ts
import { zodSchemaConfig } from 'orchid-orm-zod-schema-to-zod';
import { z } from 'zod';

export const BaseTableWithZod = createBaseTable({
  // 或使用 'orchid-orm-valibot' 的 valibotSchemaConfig
  schemaConfig: zodSchemaConfig,

  columnTypes: (t) => ({
    ...t,
    timestamp() {
      return (
        t
          .timestamp()
          // 第一个参数为所选验证库的 schema
          .encode(z.number(), (input: number) => new Date(input))
          .parse(z.number(), (input) => new Date(input).getTime())
          .as(t.integer())
      );
    },
  }),
});
```

上述示例演示了如何覆盖列类型，
但对于 timestamp，有预定义的快捷方式。

`timestamp().asNumber()` 可将 timestamp 编码/解析为数字，

`timestamp().asDate()` 可将 timestamp 编码/解析为 `Date` 对象。

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // 解析为 `Date` 对象：
    timestamp: () => t.timestamp().asDate(),
    // 或解析为数字：
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

## 覆盖默认验证

ORM 本身不做输入校验，
请在请求处理器中使用 `Table.inputSchema()`（见[验证方法](/zh-CN/guide/columns-validation-methods)），
这样可保证用户无法提交空或超长用户名等文本数据。

务必校验用户提交文本的最小和最大长度，
否则用户可提交空文本或超长文本。

你可以强制 `text` 类型必须指定最小和最大参数：

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min: number, max: number) => t.text().min(min).max(max),
  }),
});
```

这样所有文本列都需明确指定最小和最大参数：

```ts
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    content: t.text(3, 10000),
  }));
}
```
