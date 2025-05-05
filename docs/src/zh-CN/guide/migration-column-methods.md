---
outline: deep
---

# 迁移列方法

[列方法](/zh-CN/guide/common-column-methods) 中描述的所有方法在迁移中仍然适用，
用于添加或更改具有特定类型的列。

本文档描述了在应用程序代码和迁移中都有效的常用方法，例如 `default`、`nullable`、`primaryKey`，
以及仅在迁移中有效的方法，例如 `check`、`comment`、`collate`。

## default

为列设置数据库级别的默认值。值可以是原始 SQL。

在 ORM 表中使用时，`default` 可以接受一个回调，但在迁移中不适用。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    active: t.boolean().default(false),
    date: t.date().default(t.sql`now()`),
  }));
});
```

如果为 `default` 提供一个函数，它将在创建记录之前由 ORM 调用，但在数据库级别不会有任何默认值。

```ts
import { change } from '../dbScript';
import { uuidv7 } from 'uuidv7';

change(async (db) => {
  await db.createTable('table', (t) => ({
    // uuidv7 是一个函数，在迁移中会被忽略，
    // 列在数据库级别不会有 `DEFAULT`：
    id: t.uuid().primaryKey().default(uuidv7),
  }));
});
```

[uuid().primaryKey()](/zh-CN/guide/columns-types#uuid) 默认具有 `gen_random_uuid()`，如果想要删除它，请使用 `default(null)`：

```ts
id: t.uuid().primaryKey().default(null),
```

## nullable

默认情况下，每列都会添加 `NOT NULL`。使用 `nullable` 来避免这种情况：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().nullable(),
  }));
});
```

## enum

在迁移中，`enum` 接受一个枚举名称作为单个参数，与 ORM 中的 `enum` 列不同。

要创建一个新的枚举类型，请在创建表之前使用 `createEnum`。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createEnum('mood', ['sad', 'ok', 'happy']);

  await db.createTable('table', (t) => ({
    mood: t.enum('mood'),
  }));
});
```

## 生成列

[//]: # 'has JSDoc in columnType'

定义一个生成列。`generated` 接受一个原始 SQL。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    two: t.integer().generated`1 + 1`,
  }));
});
```

[//]: # 'has JSDoc in columns/string'

对于 `tsvector` 列类型，它还可以接受语言（可选）和列：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.id(),
    title: t.text(),
    body: t.text(),
    // 将 title 和 body 合并为单个 ts_vector
    generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
    // 指定语言：
    spanishTsVector: t
      .tsvector()
      .generated('spanish', ['title', 'body'])
      .searchIndex(),
  }));
});
```

## primaryKey

将列标记为主键。此列类型将成为 `.find` 方法的参数。
因此，如果主键是 `integer` 类型，`.find` 将接受数字；
如果主键是 `uuid` 类型，`.find` 将期望一个字符串。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    // 可选地，指定数据库级别的约束名称：
    id: t.identity().primaryKey('primary_key_name'),
  }));
});
```

### 复合主键

在多个列上指定 `primaryKey` 以创建复合主键。`.find` 仅适用于单个主键。

复合键在定义用于连接其他表的连接表时非常有用。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text().primaryKey(),
    active: t.boolean().primaryKey(),
  }));
});
```

或者，使用 `t.primaryKey([column1, column2, ...columns])` 指定由多个列组成的主键。

默认情况下，Postgres 将底层约束命名为 `${table name}_pkey`。您可以传递第二个参数以自定义名称。

在 `createTable` 中，将复合主键传递到第二个函数中。与仅接受单个函数的 `changeTable` 不同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable(
    'table',
    (t) => ({
      id: t.integer(),
      name: t.text(),
      active: t.boolean(),
    }),
    () => t.primaryKey(['id', 'name', 'active'], { name: 'tablePkeyName' }),
  );

  await db.changeTable('otherTable', (t) => ({
    newColumn: t.add(t.integer()),
    ...t.change(t.primaryKey(['id'], ['id', 'newColumn'])),
  }));
});
```
