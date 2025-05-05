# 通用列方法

以下所有方法适用于任何类型的列。

## primaryKey

[//]: # 'has JSDoc'

将列标记为主键。
此列类型将成为 [find](/zh-CN/guide/query-methods#find-and-findoptional) 方法的参数。
因此，如果主键是 `integer` 类型（`identity` 或 `serial`），[find](/zh-CN/guide/query-methods#find-and-findoptional) 将接受数字；
如果主键是 `UUID` 类型，[find](/zh-CN/guide/query-methods#find-and-findoptional) 将期望一个字符串。

在 `uuid` 列上使用 `primaryKey` 会自动添加 [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) 默认值。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    // 可选地，指定数据库级约束名称：
    id: t.uuid().primaryKey('primary_key_name'),
  }));
}

// 主键稍后可以通过 `find` 使用：
db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
```

## default

[//]: # 'has JSDoc'

为列设置默认值。具有默认值的列在创建记录时变为可选。

如果提供一个值或原始 SQL，则应在迁移中将此默认值设置在列上，以便在数据库级别应用。

或者，你可以指定一个返回值的回调函数。
此函数将在每次创建记录时调用。此类默认值不会应用于数据库。
如果列具有编码函数（如 json、timestamp 列），它将用于序列化返回的默认值。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // 值作为默认值：
    int: t.integer().default(123),
    text: t.text().default('text'),

    // 原始 SQL 默认值：
    timestamp: t.timestamp().default(t.sql`now()`),

    // 运行时默认值，每条新记录都会获得一个新的随机值：
    random: t.numeric().default(() => Math.random()),
  }));
}
```

## hasDefault

[//]: # 'has JSDoc'

使用 `hasDefault` 使列在创建记录时可以省略。

最好使用 [default](#default)，这样值是显式的，并作为提示。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t.text().hasDefault(),
  }));
}
```

## nullable

[//]: # 'has JSDoc'

使用 `nullable` 将列标记为可空。默认情况下，所有列都是必需的。

可空列在创建记录时是可选的。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    name: t.integer().nullable(),
  }));
}
```

## identity

适用于 `smallint`、`integer`、`bigint`。

它与使用 `serial` 几乎相同，但 Postgres 团队[官方不推荐](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_serial)使用 `serial`，
并建议使用 `identity` 作为首选的自增类型。

`t.identity()` 是 `t.integer().identity()` 的快捷方式。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    small: t.smallint().identity(),
    int: t.identity(),
    alsoInt: t.integer().identity(),
    big: t.bigint().identity(),
  }));
}
```

Postgres 支持 `BY DEFAULT` 和 `ALWAYS` 两种 identity 类型。
`BY DEFAULT` identity 允许在创建和更新记录时手动设置，而 `ALWAYS` 不允许。

`Orchid ORM` 默认使用 `BY DEFAULT`，以防你希望手动设置 id。

支持的选项：

```ts
type IdentityOptions = {
  // 默认为 false，设置为 true 表示使用 GENERATE ALWAYS
  always?: boolean;

  // identity 序列选项，详细信息请参阅 Postgres 文档：
  incrementBy?: number;
  startWith?: number;
  min?: number;
  max?: number;
  cache?: number;
  cycle?: boolean;
};
```

## exclude from select

[//]: # 'has JSDoc'

在列上附加 `select(false)` 以将其从默认选择中排除。
它不会被 `selectAll` 或 `select('*')` 选择。

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string().select(false),
  }));
}

// 仅选择 id 和 name，不包括 password
const user = await db.user.find(123);

// 即使使用通配符，password 仍然被省略
const same = await db.user.find(123).select('*');

const comment = await db.comment.find(123).select({
  // 在子选择中，password 也被省略
  author: (q) => q.author,
});

// 在创建记录时，password 也被省略
const created = await db.user.create(userData);
```

此类列只能显式选择。

```ts
const userWithPassword = await db.user.find(123).select('*', 'password');
```

## name

指定列在数据库中的真实名称：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    nameInApp: t.name('name_in_database').integer(),
  }));
}
```

## encode

[//]: # 'has JSDoc'

设置一个自定义函数，在创建或更新记录时处理列的值。

`input` 参数的类型将用作创建和更新时列的类型。

如果你[安装并配置了验证库](/zh-CN/guide/columns-validation-methods)，
第一个参数是用于验证输入的模式。

```ts
import { z } from 'zod';

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // 在保存之前将布尔值、数字或字符串编码为文本
    column: t
      .string()
      // 如果有验证库，第一个参数是验证模式
      .encode(
        z.boolean().or(z.number()).or(z.string()),
        (input: boolean | number | string) => String(input),
      )
      // 否则没有模式参数
      .encode((input: boolean | number | string) => String(input)),
  }));
}

// 数字和布尔值将被转换为字符串：
await db.table.create({ column: 123 });
await db.table.create({ column: true });
await db.table.where({ column: 'true' }).update({ column: false });
```

## parse

[//]: # 'has JSDoc'

设置一个自定义函数，在从数据库加载值后处理它。

输入的类型是 `.parse` 之前的列类型，结果类型将替换列的类型。

如果你[安装并配置了验证库](/zh-CN/guide/columns-validation-methods)，
第一个参数是用于验证输出的模式。

处理 `null` 值时，请使用 [parseNull](#parse-null) 替代或补充。

```ts
import { z } from 'zod';
import { number, integer } from 'valibot';

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    columnZod: t
      .string()
      // 如果有验证库，第一个参数是模式
      .parse(z.number().int(), (input) => parseInt(input))
      // 否则没有模式参数
      .parse((input) => parseInt(input)),

    columnValibot: t
      .string()
      .parse(number([integer()]), (input) => parseInt(input))
      .parse((input) => parseInt(input)),
  }));
}

// 列将被解析为数字
const value: number = await db.table.get('column');
```

## parseNull

[//]: # 'has JSDoc'

使用 `parseNull` 在选择时指定运行时默认值。

`parseNull` 函数仅对 `nullable` 列触发。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t
      .integer()
      .parse(String) // 将非空值解析为字符串
      .parseNull(() => false), // 将空值替换为 false
      .nullable(),
  }));
}

const record = await db.table.take()
record.column // 可以是字符串或布尔值，不为空
```

如果你[安装并配置了验证库](/zh-CN/guide/columns-validation-methods)，
第一个参数是用于验证输出的模式。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t
      .integer()
      .parse(z.string(), String) // 将非空值解析为字符串
      .parseNull(z.literal(false), () => false), // 将空值替换为 false
    .nullable(),
  }));
}

const record = await db.table.take()
record.column // 可以是字符串或布尔值，不为空

Table.outputSchema().parse({
  column: false, // 模式期望字符串或 `false` 字面值，不为空
})
```

## as

[//]: # 'has JSDoc'

此方法将列类型更改为将一个列视为另一个列，这会影响 `where` 中的可用列操作。

在调用 `.as` 之前，需要使用 `.encode`，输入类型与目标列的输入类型相同，
以及 `.parse`，返回正确的类型。

```ts
// 列具有与 t.integer() 相同的类型
const column = t
  .string()
  .encode((input: number) => input)
  .parse((text) => parseInt(text))
  // 如果包含验证库，则需要模式参数
  .encode(z.number(), (input: number) => input)
  .parse(z.number(), (text) => parseInt(text))
  .as(t.integer());
```

## asType

[//]: # 'has JSDoc'

将列标记为具有特定的 Typescript 类型。
这可用于缩小通用列类型，例如将 `string` 缩小为字符串字面值联合。

如果未为[验证库](/zh-CN/guide/columns-validation-methods)指定 `schemaConfig` 选项，则语法如下：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    size: t.string().asType((t) => t<'small' | 'medium' | 'large'>()),
  }));
}

// size 将被类型化为 'small' | 'medium' | 'large'
const size = await db.table.get('size');
```

要分别更改基础、输入、输出和查询类型，请将它们作为泛型参数传递：

```ts
const column = t
  .text()
  .asType((t) => t<Type, InputType, OutputType, QueryType>());
```

- 第一个 `Type` 是基础类型，用作其他类型的默认值。
- `InputType` 用于 `create`、`update` 方法。
- `OutputType` 用于从数据库加载的数据，并在列具有 `parse` 时进行解析。
- `QueryType` 用于 `where` 和其他查询方法，它应与实际数据库列类型兼容。

如果使用[验证库](/zh-CN/guide/columns-validation-methods)，还需提供验证模式：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    size: t.text().asType({
      type: z.union([
        z.literal('small'),
        z.literal('medium'),
        z.literal('large'),
      ]),
    }),
  }));
}

// size 将被类型化为 'small' | 'medium' | 'large'
const size = await db.table.get('size');
```

同一模式将用于输入、输出和查询。

你可以为不同用途设置不同的模式：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    size: t.text().asType({
      input: z.literal('input'),
      output: z.literal('output'),
      query: z.literal('query'),
    }),
  }));
}
```

## timestamps

添加类型为 `timestamp`（带时区）的 `createdAt` 和 `updatedAt` 列，默认 SQL 为 `now()`。

带时区的时间戳优于不带时区的时间戳，因为 Postgres 文档建议如此[建议](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_timestamp_.28without_time_zone.29)。

`timestamps` 函数内部使用 `timestamp`。如果 `timestamp` 被重写为解析为 `Date`，`timestamps` 也会如此。

`updatedAt` 添加了一个钩子，用于在每次 `update` 查询时刷新其日期，除非在更新记录时显式设置 `updatedAt`。

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...t.timestamps(),
  }));
}
```

可以通过以下方式自定义列名称：

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    // `created` 也将用于引用此列的 SQL
    created: t.timestamps().createdAt,
    updated: t.timestamps().updatedAt,
  }));
}
```

## timestampsNoTZ

与 `timestamps` 相同，但没有时区。

## modifyQuery

指定一个可以修改表类的回调。

在此回调中修改查询时，更改将应用于该表的所有未来查询。

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.string().modifyQuery((table, column) => {
      // table 参数是 SomeTable 的查询接口
      // column 对象包含列名和其他属性的数据
    }),
  }));
}
```

## 迁移的方法

列方法如 [foreignKey](/zh-CN/guide/migration-column-methods#foreignkey)、[index](/zh-CN/guide/migration-column-methods#index)、[exclude](/zh-CN/guide/migration-column-methods#exclude)、[unique](/zh-CN/guide/migration-column-methods#unique)、[comment](/zh-CN/guide/migration-column-methods#comment) 等仅在迁移中使用时有效，详细信息请参阅[迁移列方法](/zh-CN/guide/migration-column-methods)文档。

尽管 `unique` 用于派生类型以用于 [findBy](/zh-CN/guide/query-methods#findBy) 和 [onConflict](/zh-CN/guide/create-update-delete#onconflict)。
