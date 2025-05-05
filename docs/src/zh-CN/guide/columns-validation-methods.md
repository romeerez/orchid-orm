# 列的验证方法

通常建议在应用程序从客户端接收数据时，在控制器层（即路由处理器）进行验证。

ORM 和查询构建器不会执行验证，因为假设数据在到达 ORM 时已经被验证。

你可以使用额外的包将列模式转换为验证模式。

本节中描述的列方法对解析、编码值或迁移中的表模式**没有**影响，
它们仅影响由 `Table.createSchema()`、`Table.updateSchema()` 等方法暴露的验证模式。

支持 [Zod](https://github.com/colinhacks/zod) 和 [Valibot](https://valibot.dev/)。

:::warning
此方法不适用于在单体仓库（monorepo）中与前端共享模式。

设计仅用于后端。
:::

安装包：

```sh
# 对于 zod
npm i orchid-orm-schema-to-zod
# 对于 valibot
npm i orchid-orm-valibot
```

将 `BaseTable` 的 `schemaConfig` 设置为 `zodSchemaConfig` 或 `valibotSchemaConfig`：

```ts
import { createBaseTable } from 'orchid-orm';

import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
// 或
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  schemaConfig: zodSchemaConfig,
  // 或
  schemaConfig: valibotSchemaConfig,
});
```

所有表类现在将为不同目的暴露验证模式。

- `Table.inputSchema()` - 验证用于插入记录的输入数据，主键不会被省略。
  可空列和具有默认值的列是可选的，其余列是必需的。
  时间戳可以接受字符串或数字。

- `Table.outputSchema()` - 验证从数据库返回的数据的模式，
  对测试目的可能有用。

- `Table.querySchema()` - 是部分模式，用于验证 `where` 或 `find` 中的参数。
  除非你自定义列的 `parse` 函数，否则类型与 `inputSchema` 中的类型相同。

- `Table.pkeySchema()` - 从 `querySchema` 中挑选主键，验证类似 `{ id: 123 }` 的对象。

- `Table.createSchema()` - `inputSchema` 省略主键，用于验证创建记录的数据。

- `Table.updateSchema()` - 省略主键，部分 `inputSchema` 用于更新记录。

在控制器中使用它：

```ts
// 我们希望验证从客户端发送的参数：
const params = req.body;

// `inputSchema` 是你选择的库的类型。
// 使用 zod 解析：
const zodValidated = SomeTable.inputSchema().parse(params);
// 使用 valibot 解析：
const valibotValidated = parse(SomeTable.inputSchema(), params);

// zod 模式可以使用 `pick`、`omit`、`and`、`merge`、`extend` 等方法扩展：
const extendedZodSchema = SomeTable.inputSchema()
  .pick({
    name: true,
  })
  .extend({
    additional: z.number(),
  });

// valibot 的用法类似：
const extendedValibotSchema = merge(
  pick(SomeTable.inputSchema(), ['name']),
  object({
    additional: number(),
  }),
);
```

`inputSchema()` 和类似方法在第一次调用时构建模式，并在后续调用中记住它。

## 错误

使用 `errors` 方法自定义列类型的错误。

对于 zod，为 `required` 和 `invalidType` 错误设置消息：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    intColumn: t.integer().errors({
      required: '此列是必需的',
      invalidType: '此列必须是整数',
    }),
  }));
}
```

对于 valibot，提供单个验证消息：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    intColumn: t.integer().errors('此列必须是整数'),
  }));
}
```

每个验证方法都可以接受一个字符串作为错误消息：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    notTooShortText: t.text().min(5, '必须至少包含 5 个字符'),
    notTooLongText: t.text().max(5, '必须最多包含 5 个字符'),
    fiveCharsText: t.text().length(5, '必须正好包含 5 个字符'),
    email: t.text().email('无效的电子邮件地址'),
    url: t.text().url('无效的 URL'),
    emojiText: t.text().emoji('包含非表情符号字符'),
    uuid: t.text().uuid('无效的 UUID'),
    aboutTuna: t.text().includes('tuna', '必须包含 tuna'),
    httpsLink: t.text().startsWith('https://', '必须提供安全的 URL'),
    dotComLink: t.text().endsWith('.com', '仅允许 .com 域名'),
  }));
}
```

仅适用于 zod：`text().datetime()` 和 `text().ip()` 方法可以有自己的参数，
因此错误消息通过对象传递。

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    stringDate: t.text().datetime({
      message: '无效的日期时间字符串！必须是 UTC。',
      offset: true,
    }),
    ipAddress: t.text().ip({ message: '无效的 IP 地址', version: 'v4' }),
  }));
}
```

## 扩展验证模式

使用 `inputSchema`、`outputSchema`、`querySchema` 扩展验证模式：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    zodColumn: t
      .string()
      .inputSchema((s) => s.default('仅用于验证的默认值'))
      .outputSchema((s) =>
        s.transform((val) => val.split('').reverse().join('')),
      ),
    valibotColumn: t
      .string()
      .inputSchema((s) => optional(s, '仅用于验证的默认值'))
      .outputSchema((s) =>
        transform(s, (val) => val.split('').reverse().join('')),
      ),
  }));
}
```

## 数值列

数值列 `smallint`、`integer`、`numeric`、`decimal`、`real`、`smallSerial` 和 `serial` 支持以下验证方法：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .integer()
      .lt(number) // 必须小于 number
      .lte(number) // 必须小于或等于 number
      .max(number) // .lte 的别名
      .gt(number) // 必须大于 number
      .gte(number) // 必须大于或等于 number
      .min(number) // .gte 的别名
      .positive() // 必须大于 0
      .nonNegative() // 必须大于或等于 0
      .negative() // 必须小于 0
      .nonPositive() // 必须小于或等于 0
      .step(number) // 必须是 number 的倍数
      .finite() // 仅对 `numeric`、`decimal`、`real` 有用，因为 Infinity 不会通过整数检查
      .safe(), // 在 number.MIN_SAFE_INTEGER 和 number.MAX_SAFE_INTEGER 之间
  }));
}
```

## 文本列

文本列 `varchar`、`char` 和 `text` 支持以下验证方法：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .text()
      .nonEmpty() // 等价于 .min(1)
      .min(1)
      .max(10)
      .length(5)
      .email()
      .url()
      .emoji()
      .uuid()
      .cuid()
      .cuid2()
      .ulid()
      // 参见 Zod 文档了解 datetime 参数，Valibot 不支持参数
      .datetime({ offset: true, precision: 5 })
      // 仅适用于 Zod：v4、v6 或不传递参数以支持两者
      .ip({ version: 'v4' })
      .regex(/regex/)
      .includes('str')
      .startsWith('str')
      .endsWith('str')
      .trim()
      .toLowerCase()
      .toUpperCase(),
  }));
}
```

## 数组列

数组列支持以下验证方法：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .integer()
      .nonEmpty() // 至少需要一个元素
      .min(number) // 设置数组最小长度
      .max(number) // 设置数组最大长度
      .length(number), // 设置数组的确切长度
  }));
}
```
