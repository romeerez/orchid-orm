# 列类型

## 数值类型

由于并非所有数据库的数值类型都能适配 JavaScript 的 `number` 类型，因此某些类型会以字符串形式返回。

数值类型可以在 `WHERE` 条件中使用[数值操作符](/zh-CN/guide/where.html#numeric-and-date-operators)。

```ts
// 有符号的两字节整数
t.smallint() // -> number

// 有符号的四字节整数
t.integer() // -> number

// 有符号的八字节整数
t.bigint() // -> string

// 可选精度的精确数值
t.numeric(precision?: number, scale?: number) // -> string

// decimal 是 numeric 的别名
t.decimal(precision?: number, scale?: number) // -> string

// 单精度浮点数（4 字节）
t.real() // -> number

// 双精度浮点数（8 字节）
t.doublePrecision() // -> number

// 自动递增整数（默认生成为 IDENTITY）
t.identity() // -> number

// 自动递增两字节整数
t.smallSerial() // -> number

// 自动递增四字节整数
t.serial() // -> number

// 自动递增八字节整数
t.bigSerial() // -> string
```

如上代码注释所列，`bigint`、`numeric`、`decimal` 和 `bigSerial` 的输出为字符串。

你可以设置解析为 `number` 类型（请注意，这可能会导致大数字上的错误）：

```ts
t.bigint().parse(parseInt);
```

或者将 Postgres 的 `bigint` 类型解析为 JavaScript 的 `bigint` 类型，但请注意，在准备 JSON 响应时，这些值应显式转换为字符串：

```ts
t.bigint().parse(BigInt);
```

数值类型的列支持以下 `where` 操作符：

```ts
db.someTable.where({
  numericColumn: {
    // 小于
    lt: value,
    // 小于或等于
    lte: value,
    // 大于
    gt: value,
    // 大于或等于
    gte: value,
    // 在 x 和 y 之间
    between: [x, y],
  },
});
```

## 文本类型

- `t.text()` 用于无限制的数据库 `text` 类型。
- `t.varchar(limit?: number)` 用于在数据库级别限制长度的文本。
  如果未指定限制，则与 Postgres 的 `TEXT` 类型相同。
- `t.string(limit = 255)` 与 `varchar` 相同，默认限制为 255。

文本类型可以在 `WHERE` 条件中使用[文本操作符](/zh-CN/guide/where.html#text-operators)。

```ts
// 无限长度的文本
t.text() // -> string

// 有长度限制的可变长度文本
t.varchar(limit?: number) // -> string

// `varchar` 类型，默认限制为 255
t.string(limit?: number = 255) // -> string
```

未添加 `char` 数据库类型，因为 Postgres [不推荐使用](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_char.28n.29)。

## citext

[citext](https://www.postgresql.org/docs/current/citext.html) 是一种数据库类型，其行为几乎与 `text` 相同，
但在所有操作中不区分大小写。

要使用它，首先启用 `citext` 扩展，创建迁移：

```sh
npm run db new enableCitext
```

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createExtension('citext');
});
```

```sh
npm run db migrate
```

现在 `citext` 可用，可以像 `text` 类型一样使用。
它支持相同的操作符。

```ts
// 无限长度的文本变量
t.citext(); // -> string
```

## tsvector

用于全文搜索：为文本向量定义一个生成的列。

请参阅[生成的](/zh-CN/guide/migration-column-methods#enum)迁移方法。

```ts
// 从其他文本列生成 `ts_vector`
t.tsvector().generated(['title', 'body']).searchIndex();
```

## tsquery

用于存储查询的全文搜索。

```ts
// tsquery 值存储要搜索的词元
t.tsquery(); // -> string
```

## 二进制类型

bytea 数据类型允许存储二进制字符串，返回为 node.js 的 Buffer 对象。

```ts
t.bytea(); // -> Buffer
```

## 日期和时间

日期时间类型可以在 `WHERE` 条件中使用[日期操作符](/zh-CN/guide/where.html#numeric-and-date-operators)。

```ts
// 4 字节日期（无时间）
t.date() // -> string

// 带时区的时间戳（8 字节）
t.timestamp(precision?: number) // -> string

// 不带时区的时间戳（8 字节），不推荐使用
t.timestampNoTZ(precision?: number) // -> string

// 不带时区的时间（8 字节）
// 格式为 00:00:00
t.time(precision?: number) // -> string

// 不添加带时区的时间，因为根据 Postgres 文档不应使用。
```

未包含带时区的时间，因为 Postgres 文档[不推荐使用](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_timetz)。

`date`、`timestamp` 和 `timestampNoTZ` 可以使用方法 `asNumber` 和 `asDate` 自定义，将数据库值解析为数字和 JS Date 对象。

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // 或使用 `.asDate()` 以 Date 对象形式处理
    timestamp: () => t.timestamp().asNumber(),
  }),
});

// 时间戳列现在以数字形式返回，或者如果选择 `asDate` 则以 Date 对象形式返回：
const { updatedAt, createdAt } = await db.table.take();
```

在按时间戳字段过滤、创建或更新记录时，可以使用编码为字符串、数字或 Date 对象的日期：

```ts
// 使用 Date 对象过滤、更新、创建：
const date = new Date();
db.table.where({ createdAt: date });
db.table.find(id).update({ ...data, createdAt: date });
db.table.create({ ...data, createdAt: date });

// 使用 ISO 编码日期字符串过滤、更新、创建
const string = new Date().toISOString();
db.table.where({ createdAt: string });
db.table.find(id).update({ ...data, createdAt: string });
db.table.create({ ...data, createdAt: string });

// 使用从 `getTime` 获取的数字过滤、更新、创建
const number = new Date().getTime();
db.table.where({ createdAt: number });
db.table.find(id).update({ ...data, createdAt: number });
db.table.create({ ...data, createdAt: number });
```

## interval

```ts
// interval [ fields ] [ (p) ] 16 字节   时间间隔  -178000000 年   178000000 年    1 微秒
t.interval(fields?: string, precision?: number) // -> PostgresInterval 对象
```

`interval` 类型接受两个可选参数：

第一个参数是一个包含 `YEAR`、`MONTH`、`DAY`、`HOUR` 等的字符串，完整列表请参阅 Postgres 文档[此处](https://www.postgresql.org/docs/current/datatype-datetime.html)。

第二个参数指定在第二个字段中保留的小数位数。

`interval` 列的输出是一个包含 `years`、`month` 和其他字段的对象：

```ts
type Interval = {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

const result: Interval = await Table.get('intervalColumn');
```

## 布尔类型

布尔值返回 `true` 或 `false`。

```ts
// 1 字节，true 或 false
t.boolean(); // -> boolean
```

## UUID

数据类型 uuid 存储通用唯一标识符 (UUID)。

```ts
// UUID 存储通用唯一标识符 (UUID)
t.uuid(); // -> string, 示例: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

将其用作主键时，将自动获得 [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) 默认值。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    name: t.text(),
  }));
}

// id 在数据库中生成
db.table.create({ name: 'Joe' });
```

要丢弃默认值，请使用 `default(null)`：

```ts
id: t.uuid().primaryKey().default(null),
```

如果希望使用其他默认值，`primaryKey` 将尊重它：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t
      .uuid()
      .default(() => makeOwnUUID())
      .primaryKey(),
    name: t.text(),
  }));
}

// 自定义函数将用于 id
db.table.create({ name: 'Joe' });
```

## 枚举类型

第一个参数是数据库中枚举的名称，第二个是可能值的数组：

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    enumColumn: t.enum('enumName', ['value1', 'value2', 'value3']),
  }));
}
```

为了方便并避免重复，可以在 `BaseTable` 的 `columnTypes` 中定义枚举列，然后在多个表中重复使用：

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    orderStatus: () =>
      t.enum('orderStatus', ['pending', 'cancelled', 'processed']),
  }),
});

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // 它仍然可以与常见列方法链式调用
    orderStatus: t.orderStatus().nullable(),
  }));
}
```

## JSON

Postgres 支持两种 JSON 类型：`json` 用于存储保存时的 JSON 字符串，`jsonb` 以二进制格式存储并允许其他方法。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    json: t.jsonText(),
    jsonB: t.json(),
  }));
}
```

在未使用[验证库](/zh-CN/guide/columns-validation-methods)的 ORM 时，可以为 `json` 设置任意类型。
请确保仅保存经过正确验证的数据。

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    data: t.json<{
      age: number;
      name: string;
      description: string | null;
      tags: string[];
    }>(),
  }));
}
```

启用验证库时，`json` 接受一个回调，可以在其中定义验证模式。
如果省略，则类型为 `unknown`。

```ts
import { z } from 'zod';
import { object, number, string, optional, array } from 'valibot';

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    dataZod: t.json(
      z.object({
        age: z.number(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.string().array(),
      }),
    ),
    // 或
    dataValibot: t.json(
      object({
        age: number(),
        name: string(),
        description: optional(string()),
        tags: array(string()),
      }),
    ),
  }));
}
```

`json` 列支持以下 `where` 操作符：

```ts
db.someTable.where({
  jsonColumn: {
    // 检查列中的 JSON 值是否为提供值的超集
    jsonSupersetOf: { key: 'value' },

    // 检查列中的 JSON 值是否为提供值的子集
    jsonSubsetOf: { key: 'value' },
  },
});
```

插入或更新时，json 列将使用 `JSON.stringify` 序列化数据，除非传递了 `null`。

```ts
// `data` 将设置为数据库 null，而不是 JSON null：
await db.post.create({ data: null });
await db.post.find(1).update({ data: null });
```

要插入或更新 JSON null，请为此提供 SQL：

```ts
import { sql } from './baseTable';

// 'null' 在单引号中
await db.post.create({ data: () => sql`'null'` });
```

## 几何类型

几何类型未解析，返回为数据库返回的字符串。

```ts
// 点   16 字节   平面上的点   (x,y)
t.point(); // -> string

// 线    32 字节   无限线  {A,B,C}
t.line(); // -> string

// 线段    32 字节   有限线段    [(x1,y1),(x2,y2)]
t.lseg(); // -> string

// 矩形框 32 字节   矩形框    ((x1,y1),(x2,y2))
t.box(); // -> string

// 路径    16+16n 字节   闭合路径（类似于多边形）   ((x1,y1),...)
// 路径    16+16n 字节   开放路径  [(x1,y1),...]
t.path(); // -> string

// 多边形 40+16n 字节   多边形（类似于闭合路径）   ((x1,y1),...)
t.polygon(); // -> string

// 圆  24 字节   圆 <(x,y),r>（中心点和半径）
t.circle(); // -> string
```

## 网络地址

```ts
// CIDR    7 或 19 字节  IPv4 和 IPv6 网络
t.cidr(); // -> string, 示例: 192.168.100.128/25

// inet    7 或 19 字节  IPv4 和 IPv6 主机和网络
t.inet(); // -> string, 示例: 192.168.100.128/25

// macaddr 6 字节    MAC 地址
t.macaddr(); // -> string, 示例: 08:00:2b:01:02:03

// macaddr8    8 字节    MAC 地址（EUI-64 格式）
t.macaddr8(); // -> string, 示例: 08:00:2b:ff:fe:01:02:03
```

## 位字符串

位字符串是由 1 和 0 组成的字符串。它们可用于存储或可视化位掩码。

```ts
// 位字符串是由 1 和 0 组成的字符串。
// 它们可用于存储或可视化位掩码。
// 有两种 SQL 位类型：bit(n) 和 bit varying(n)，其中 n 是正整数。
t.bit(); // -> string

// bit varying(n)，其中 n 是正整数
t.bitVarying(); // -> string
```

## 数组

```ts
// 其他列类型的数组
t.array(t.text()); // -> 参数类型的数组
```

请参阅 `WHERE` 条件的[数组操作符](/zh-CN/guide/where.html#array-operators)。

## 不支持的类型

对于用户定义的自定义类型，或者某些尚未支持的数据库类型，请使用 `type` 和 `as` 将此列视为其他类型：

```ts
t.type('type_name').as(t.integer());
```

## 域

域是允许预定义 `NOT NULL` 和 `CHECK` 的自定义数据库类型（请参阅[Postgres 教程](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)）。

与 `type` 类似，指定 `as(otherType)` 将此列在查询中视为其他类型：

```ts
t.domain('domainName').as(t.integer());
```

## 货币类型

用于货币金额（8 字节）

```ts
t.money(); // -> string, 示例: '$12.34'
```

## XML

XML 数据类型可用于存储 XML 数据

```ts
t.xml(); // -> string
```

## Postgis 地理类型

Postgis 仅提供非常基础的支持，如果需要更多支持，请打开 issue。

以下是地理点类型：

```ts
t.geography.point();
```

在迁移中，该类型将具有默认的 `4326` SRID。

输入和输出类型为：

```ts
type PostgisPoint {
  lon: number;
  lat: number;
  srid?: number; // 默认 4326 不存在
}
```
