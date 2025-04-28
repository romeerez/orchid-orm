---
outline: deep
---

# 测试工厂

`Orchid ORM` 生态系统提供了一个库，用于设置 JavaScript 对象，以在测试中使用这些对象。

它生成的对象形状由您的表列定义。

表模式在输入（插入）和输出（选择）时可能有所不同，测试工厂使用输入模式。

随机值由 [faker.js](https://www.npmjs.com/package/@faker-js/faker) 生成，您可以使用 `faker.seed(1)` 在测试中固定随机性以生成相同的值。

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db);

const user = factory.user.build();
// user 是一个具有随机值的对象，例如：
// {
//   id: 89613,
//   name: 'Jackie Homenick',
//   password: 'MHDDzAPYHzuklCN',
// }

// 将具有随机值的用户保存到数据库
const createdUser = await factory.user.create();

// 创建具有特定电子邮件的多个用户
const manyUsers = await factory.user.createMany(
  { email: 'one@email.com' },
  { email: 'two@email.com' },
);
```

`build` 和 `create` 方法将以某种方式处理时间戳字段：

- 如果记录包含多个时间戳（例如 `createdAt` 和 `updatedAt`），则每个字段的值将相等；
- 如果您有配置为数字时间戳的列（`t.timestamp().asNumber()`），字段将具有相等的数字时间戳；
- `t.timestamp()` 返回字符串和 `t.timestamp().asDate()` 返回 `Date` 对象都生成相等的日期。

每个新生成的对象的时间戳将增加 1 毫秒，
因此创建记录列表然后测试按时间戳排序的查询应该可以正常工作。

默认情况下，所有文本列生成的字符串长度最多为 1000 个字符。
您可以通过指定 `maxTextLength` 来覆盖最大限制：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db, {
  maxTextLength: 123,
});
```

## 示例

此示例摘自[构建示例应用程序](https://github.com/romeerez/orchid-orm-sample-blog-api-guide)，您可以在该文档中找到更多测试示例。

这里我们使用 `build` 来构建测试请求的参数，并使用 `create` 来创建记录以测试如何处理唯一性冲突。

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db);

describe('注册', () => {
  const params = factory.user.pick({
    username: true,
    email: true,
    password: true,
  });

  it('应该注册一个新用户', async () => {
    // 构建一个新的随机用户数据：
    const data = params.build();

    // testRequest 可能是 light-my-request、axios、supertest 的包装器
    // 使用数据执行对 /users 的 POST 请求：
    const res = await testRequest.post('/users', data);

    const json = res.json();

    // 期望响应具有与我们发送的相同的数据：
    expect(json).toMatchObject({
      username: data.username,
      email: data.email,
    });

    // 期望数据库中有一个新注册的用户，其字段正确：
    const savedUser = await db.user.findBy({ username: data.username });
    expect(savedUser).toMatchObject({
      username: data.username,
      email: data.email,
    });
  });

  it('当用户名被占用时应该返回错误', async () => {
    // 构建一个新的随机用户数据：
    const data = params.build();

    // 创建一个具有随机数据的新用户，但此特定用户名：
    await factory.user.create({ username: data.username });

    const res = await testRequest.post('/users', data);

    // 期望响应失败并显示消息：
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      message: '用户名已被占用',
    });
  });
});
```

## 设置

安装此库和 faker.js：

```sh
npm i -D orchid-orm-test-factory @faker-js/faker
```

从您拥有测试实用程序的某个文件中导出 `factory`：

```ts
// src/utils/test-utils.ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

export const factory = ormFactory(db);
```

## 每个表覆盖生成器

为特定表定义自定义数据生成器：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db, {
  extend: {
    myTableName: {
      // 每次为此列生成数据时调用
      columnName(sequence) {
        // 利用序列递增值保持数据唯一
        return `自定义字符串 ${sequence}`;
      },
    },
  },
});
```

## JSON

如果您没有使用 ORM 的 zod 模式集成，
您可以定义一个自定义函数以返回表所需的 JSON 形状：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db, {
  extend: {
    myTableName: {
      // 每次为此列生成数据时调用
      jsonColumnName(sequence) {
        // 利用序列递增值保持数据唯一
        return {
          number: sequence,
          text: `一些文本 ${sequence}`,
        };
      },
    },
  },
});
```

如果您正在使用 [zod 模式](/zh-CN/guide/columns-validation-methods) 和 ORM，
您可以安装并集成 [@anatine/zod-mock](https://github.com/anatine/zod-plugins/tree/main/packages/zod-mock)
以根据定义的模式自动生成 JSON 数据。

```shell
npm install @anatine/zod-mock
```

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';
import { ZodAnyType } from 'zod';
import { generateMock } from '@anatine/zod-mock';

const factory = ormFactory(db, {
  fakeDataForTypes: {
    jsonb(column) {
      const zodSchema = column.inputSchema as ZodAnyType;
      return () => generateMock(zodSchema);
    },
  },
});
```

如果您使用的是 valibot 模式，也有一个库：[valimock](https://github.com/Saeris/valimock)。

```shell
npm i -D valimock
```

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';
import { BaseSchema } from 'valibot';
import { Valimock } from 'valimock';

const factory = ormFactory(db, {
  fakeDataForTypes: {
    jsonb(column) {
      const valibotSchema = column.inputSchema as BaseSchema;
      const valimock = new Valimock();
      return () => valimock.mock(valibotSchema);
    },
  },
});
```

## 序列

工厂内部保留一个 `sequence` 数字，每个新记录增加 1。

在使用自定义函数覆盖字段值时可以使用序列：

```ts
const records = factory.user.buildList(3, {
  id: (sequence) => sequence,
  email: (sequence) => `email-${sequence}@mail.com`,
});
```

以这种方式，每个记录可以具有唯一的 `id` 和 `email`。

现代测试框架和 `Jest` 并行运行测试套件，
这可能导致 2 个测试套件尝试将具有相同 `email-1@mail.com` 电子邮件的记录保存到数据库。

此问题通过使用 `process.env.JEST_WORKER_ID` 环境变量专门处理：如果定义了此变量，
`orchid-orm-test-factory` 将从 `(workerId - 1) * sequenceDistance + 1` 开始序列，其中 `sequenceDistance` 默认为 1000。
以这种方式，第一个套件序列将从 1 开始，第二个套件序列将从 1001 开始，依此类推。

可以覆盖描述的方程的 `sequenceDistance`：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db, {
  sequenceDistance: 123456,
});
```

对于其他并行运行套件的测试框架，请在创建工厂时手动提供 `sequence`：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

// 对于 vitest 框架使用 VITEST_POOL_ID，此环境变量的行为类似于 jest 中的 JEST_WORKER_ID
const workerId = parseInt(process.env.VITEST_POOL_ID as string);

const factory = ormFactory(db, {
  sequence: (workerId - 1) * 1000 + 1,
});
```

## 构建

构建一个与您的表结构相同的对象，并填充随机数据：

```ts
import { ormFactory } from 'orchid-orm-test-factory';
import { db } from '../path-to-db';

const factory = ormFactory(db);

const user = factory.user.build();
```

可以选择将特定数据传递给 `build`：

```ts
const specificUser = factory.user.build({
  name: 'James',
  age: 30,
});
```

您可以提供一个函数来生成新值：

```ts
const user = factory.user.build({
  randomNumber: () => Math.random(),
});
```

可以提供额外的数据，这些数据未由表列定义：

```ts
const user = factory.user.build({
  customField: 'someValue',
});
```

### buildMany

使用 `buildMany` 构建多个记录。它接受与 `build` 相同的参数，但可以接受多个参数。

```ts
const [user1, user2, user3] = factory.user.buildMany(
  // 空：所有数据都已生成
  {},
  // 覆盖数据
  {
    name: 'James',
  },
  // 从函数返回动态值
  {
    age: () => Math.ceil(Math.random() * 100),
  },
);
```

### buildList

构建一个对象数组，并提供所需对象数量：

```ts
const arrayOfUsers = factory.user.buildList(5);
```

可选的第二个参数与 `build` 中的参数相同：

```ts
const arrayOfCustomizedUsers = factory.user.build(5, {
  // 数组中的每个用户都将具有其随机数
  randomNumber: () => Math.random(),
});
```

## 创建

`create` 将记录保存到数据库并返回结果：

```ts
const user = await factory.user.create();
```

在参数中，您可以提供列的值、生成值的函数，
并且可以使用此表可用的所有嵌套创建方法。

与 `build` 相比，这里不允许额外的属性，仅允许表的列。

`create` 方法将自动查找表中的标识和序列主键以省略它的生成，
因此 `t.identity().primaryKey()` 列的自然序列将被保留。

```ts
// 创建一个用户和个人资料（用户有一个个人资料）以及流派（用户有多个流派）
const customizedUser = await factory.user.create({
  name: 'Mikael',
  age: () => 49,
  profile: {
    create: {
      bio: 'Eros Ramazzotti of Sweden',
    },
  },
  genres: {
    create: [
      {
        name: 'progressive metal',
      },
      {
        name: 'progressive rock',
      },
    ],
  },
});
```

### createMany

一次创建多个记录，使用 `createMany`，它执行单个 `INSERT` 语句。

```ts
const [user1, user2, user3] = await factory.user.createMany(
  // 空：所有数据都已生成
  {},
  // 覆盖数据
  {
    name: 'James',
  },
  // 从函数返回动态值
  {
    age: () => Math.ceil(Math.random() * 100),
  },
);
```

### createList

创建一个记录数组，并提供所需对象数量：

```ts
const users = await factory.user.createList(5);
```

可选的第二个参数与 `create` 中的参数相同：

```ts
const arrayOfCustomizedUsers = await factory.user.create(5, {
  // 数组中的每个用户都将具有其随机数
  randomNumber: () => Math.random(),
});
```

您可以动态创建一个 `belongsTo` 记录并使用其 id：

```ts
// 创建 5 本书，每本书有 5 个不同的作者
const books = await factory.book.create(5, {
  author: async () => (await factory.author.create()).id,
});
```

## 唯一列

测试工厂将为唯一文本列添加序列前缀，并将使用序列作为唯一数字列。

示例：

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    text: t.text(),
    email: t.string().email().unique(),
    url: t.varchar(1000).url().unique(),
    number: t.integer().unique(),
    greaterThan10: t.integer().gt(10).unique(),
    greaterThanOrEqualTo10: t.integer().gte(10).unique(),
  }));
}

const db = createDb(
  {
    ...dbOptions,
  },
  {
    table: SomeTable,
  },
);

const factory = ormFactory(db);

// 序列从 1 开始

// 文本列以序列和空格为前缀：
factory.user.text; // '1 random text'

// 电子邮件以序列和连字符为前缀：
factory.user.email; // '1-random@email.com'

// URL 以 https:// + 序列和连字符为前缀
factory.user.url; // 'https://1-random.url/'

// 数字设置为序列
factory.user.number; // 1

// 带有 `.gt` 的数字设置为序列 + gt 值
factory.user.greaterThan10; // 11

// 带有 `.gte` 的数字设置为序列 + gt 值 - 1
factory.user.greaterThan10; // 10
```

`.max` 和 `.length` 文本列方法被考虑在内，以在添加前缀时不超过限制。

## omit

在构建对象之前省略某些字段。仅适用于 `build` 方法，`create` 将忽略它。

```ts
const partialUser = await factory.user.omit({ id: true, name: true }).build();
// partialUser 具有除 id 和 name 之外的所有内容
```

## pick

在构建对象之前选择特定字段。仅适用于 `build` 方法，`create` 将忽略它。

```ts
const partialUser = await factory.user.pick({ id: true, name: true }).build();
// partialUser 只有 id 和 name
```

## set

在构建或创建对象之前设置自定义数据。

它接受与 `build` 相同的参数。

```ts
const user = factory.user.set({ name: 'Vasya' }).build();

const createdUser = await factory.user.set({ name: 'Vasya' }).create();
```

## extend

可以使用自定义方法扩展工厂：

```ts
class UserFactory extends factory.user.extend() {
  specificUser(age: number) {
    // 可以调用其他方法
    return this.otherMethod().set({
      age,
      name: 'Specific name',
    });
  }
  otherMethod() {
    return this.set({ extra: true });
  }
}

const userFactory = new UserFactory();

const user = userFactory.specificUser().build();
```

方法可以被链式调用：

```ts
const user = userFactory
  .pick({ id: true, name: true })
  .specificUser()
  .set({ key: 'value' })
  .build();
```
