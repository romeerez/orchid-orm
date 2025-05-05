---
outline: deep
---

# 创建、更新和删除记录

我们提供了 `create` 方法，默认返回完整记录，以及 `insert` 方法，默认仅返回插入行的数量。

要在创建记录之前或之后执行自定义操作，请参阅 `beforeCreate`、`afterCreate`、`afterCreateCommit` [生命周期钩子](/zh-CN/guide/hooks)。

`create*` 和 `insert*` 方法要求列是非空且没有默认值的。

在 `create` 或 `insert` 之前或之后使用 `select` 或 `get` 来指定返回的列：

```ts
// 仅返回 `id`，使用 get('id')
const id: number = await db.table.get('id').create(data);

// 与上面相同
const id2: number = await db.table.create(data).get('id');

// 创建单条记录时返回一个对象
const objectWithId: { id: number } = await db.table.select('id').create(data);

// 与上面相同
const objectWithId2: { id: number } = await db.table.create(data).select('id');

// 创建多条记录时返回对象数组
const objects: { id: number }[] = await db.table
  .select('id')
  .createMany([one, two]);

// 对于原始 SQL 值，也返回对象数组：
const objects2: { id: number }[] = await db.table.select('id').createRaw({
  columns: ['name', 'password'],
  values: sql`custom sql`,
});
```

## create, insert

[//]: # 'has JSDoc'

`create` 和 `insert` 将创建一条记录。

每列可以接受特定值、原始 SQL 或返回单个值的查询。

```ts
import { sql } from './baseTable';

const oneRecord = await db.table.create({
  name: 'John',
  password: '1234',
});

// 使用 `.onConflictIgnore()` 时，记录可能未创建，`createdCount` 将为 0。
const createdCount = await db.table.insert(data).onConflictIgnore();

await db.table.create({
  // 原始 SQL
  column1: () => sql`'John' || ' ' || 'Doe'`,

  // 返回单个值的查询
  // 返回多个值将导致 Postgres 错误
  column2: db.otherTable.get('someColumn'),
});
```

`create` 和 `insert` 可用于 [with](/zh-CN/guide/advanced-queries#with) 表达式：

```ts
db.$queryBuilder
  // 在一个表中创建记录
  .with('a', db.table.select('id').create(data))
  // 使用第一个表记录 id 在另一个表中创建记录
  .with('b', (q) =>
    db.otherTable.select('id').create({
      ...otherData,
      aId: () => q.from('a').get('id'),
    }),
  )
  .from('b');
```

### createMany, insertMany

[//]: # 'has JSDoc'

`createMany` 和 `insertMany` 将创建一批记录。

每列可以设置特定值、原始 SQL 或查询，与 [create](#create-insert) 中相同。

如果对象之一的字段较少，则 `VALUES` 语句中将使用 `DEFAULT` SQL 关键字。

```ts
const manyRecords = await db.table.createMany([
  { key: 'value', otherKey: 'other value' },
  { key: 'value' }, // `otherKey` 将使用默认值
]);

// `createdCount` 将为 3。
const createdCount = await db.table.insertMany([data, data, data]);
```

由于 Postgres 协议的限制，具有超过 **65535** 个值的查询将在运行时失败。
为无缝解决此问题，OrchidORM 将自动批处理此类查询，并将它们包装到事务中，除非它们已经在事务中。

```ts
// OK：执行 2 次插入并包装到事务中
await db.table.createMany(
  Array.from({ length: 65536 }, () => ({ text: 'text' })),
);
```

然而，这仅适用于上述情况。如果在 `with` 语句中使用 `createMany`，或者插入用作其他查询部分中的子查询，则此方法**不起作用**。

### createRaw, insertRaw

[//]: # 'has JSDoc'

`createRaw` 和 `insertRaw` 用于使用原始 SQL 表达式创建一条记录。

提供的 SQL 将被包装到单个 `VALUES` 记录的括号中。

如果表具有运行时默认值（使用回调定义），则值将附加到您的 SQL。

`columns` 类型检查以包含所有必需列。

```ts
const oneRecord = await db.table.createRaw({
  columns: ['name', 'amount'],
  values: sql`'name', random()`,
});
```

### createManyRaw, insertManyRaw

[//]: # 'has JSDoc'

`createManyRaw` 和 `insertManyRaw` 用于使用原始 SQL 表达式创建多条记录。

接受 SQL 表达式数组，每个表达式将被包装到 `VALUES` 记录的括号中。

如果表具有运行时默认值（使用回调定义），函数将为每个 SQL 调用，并附加值。

`columns` 类型检查以包含所有必需列。

```ts
const manyRecords = await db.table.createManyRaw({
  columns: ['name', 'amount'],
  values: [sql`'one', 2`, sql`'three', 4`],
});
```

### createFrom, insertFrom

[//]: # 'has JSDoc'

这些方法用于创建单条记录，批量创建请参阅 [createManyFrom](#createManyFrom-insertManyFrom)。

`createFrom` 用于执行 `INSERT ... SELECT ...` SQL 语句，它通过执行单个查询进行选择和插入。

第一个参数是一个查询，用于单条记录，应该具有 `find`、`take` 或类似方法。

第二个可选参数是数据，将与选择查询返回的列合并。

第二个参数的数据与 [create](#create-insert) 中相同。

支持具有运行时默认值的列（使用回调定义）。
此类列的值将被注入，除非从相关表中选择或在数据对象中提供。

```ts
const oneRecord = await db.table.createFrom(
  // 在选择中，键是相关表列，值是要插入的列
  RelatedTable.select({ relatedId: 'id' }).findBy({ key: 'value' }),
  // 可选参数：
  {
    key: 'value',
  },
);
```

上述查询将生成以下 SQL：

```sql
INSERT INTO "table"("relatedId", "key")
SELECT "relatedTable"."id" AS "relatedId", 'value'
FROM "relatedTable"
WHERE "relatedTable"."key" = 'value'
LIMIT 1
RETURNING *
```

### createManyFrom, insertManyFrom

[//]: # 'has JSDoc'

类似于 `createFrom`，但用于创建多条记录。

与 `createFrom` 不同，它不接受带有数据的第二个参数，并且运行时默认值无法与之配合。

```ts
const manyRecords = await db.table.createManyFrom(
  RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
);
```

### orCreate

[//]: # 'has JSDoc'

`orCreate` 仅在未通过条件找到记录时创建记录。

`find` 或 `findBy` 必须在 `orCreate` 之前。

它接受与 `create` 命令相同的参数。

默认情况下不返回结果，在 `orCreate` 之前放置 `get`、`select` 或 `selectAll` 来指定返回的列。

```ts
const user = await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .orCreate({
    email: 'some@email.com',
    name: 'created user',
  });
```

数据可以从函数返回，如果记录已找到，则不会调用：

```ts
const user = await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .orCreate(() => ({
    email: 'some@email.com',
    name: 'created user',
  }));
```

`orCreate` 通过执行单个查询（如果记录存在）工作，如果记录不存在，则执行一个额外的查询。

首先，它执行一个 "find" 查询，查询成本与未使用 `orCreate` 时完全相同。

然后，如果未找到记录，它执行一个带有 CTE 表达式的单个查询，以尝试再次找到记录（以防记录刚刚被创建），然后如果仍未找到，则创建记录。使用这样的 CTE 允许跳过使用事务，同时仍然符合原子性。

```sql
-- 第一个查询
SELECT * FROM "table" WHERE "key" = 'value'

-- 记录可能已在这两个查询之间创建

-- 第二个查询
WITH find_row AS (
  SELECT * FROM "table" WHERE "key" = 'value'
)
WITH insert_row AS (
  INSERT INTO "table" ("key")
  SELECT 'value'
  -- 如果行已存在，则跳过插入
  WHERE NOT EXISTS (SELECT 1 FROM find_row)
  RETURNING *
)
SELECT * FROM find_row
UNION ALL
SELECT * FROM insert_row
```

### onConflict

[//]: # 'has JSDoc'

默认情况下，违反唯一约束将导致创建查询抛出错误，
您可以定义在冲突时的操作：忽略它，或将现有记录与新数据合并。

冲突发生在表具有主键或唯一索引列，
或复合主键唯一索引列集，
并且创建的行在此列中具有与表中已存在的行相同的值。

使用 [onConflictIgnore](#onconflictignore) 抑制错误并继续而不更新记录，
或使用 [merge](#onconflict-merge) 自动更新记录，
或使用 [set](#onconflict-set) 指定自己的更新值。

`onConflict` 仅接受在表定义中 `primaryKey` 或 `unique` 中定义的列名。
要指定约束，其名称也必须在表代码中的 `primaryKey` 或 `unique` 中显式设置。

Postgres 有一个限制，即单个 `INSERT` 查询只能有一个 `ON CONFLICT` 子句，并且只能针对单个唯一约束更新记录。

如果您的表有多个潜在的唯一约束违规原因，例如用户表中的用户名和电子邮件列，
请考虑使用 [upsert](#upsert)。

```ts
// 在任何冲突时忽略或合并
db.table.create(data).onConflictIgnore();

// 单列：
db.table.create(data).onConflict('email').merge();

// 列数组：
// （这需要复合主键或唯一索引，见下文）
db.table.create(data).onConflict(['email', 'name']).merge();

// 约束名称
db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();

// 原始 SQL 表达式：
db.table
  .create(data)
  .onConflict(sql`(email) where condition`)
  .merge();
```

:::info
单列的主键或唯一索引可以在列上定义：

```ts
export class MyTable extends BaseTable {
  columns = this.setColumns((t) => ({
    pkey: t.uuid().primaryKey(),
    unique: t.string().unique(),
  }));
}
```

但对于复合主键或索引（具有多个列），请在单独的函数中定义：

```ts
export class MyTable extends BaseTable {
  columns = this.setColumns(
    (t) => ({
      one: t.integer(),
      two: t.string(),
      three: t.boolean(),
    }),
    (t) => [t.primaryKey(['one', 'two']), t.unique(['two', 'three'])],
  );
}
```

:::

您可以在 `onConflict` 中使用从 `BaseTable` 文件导出的 `sql` 函数。
当您有部分索引时，它可以用于指定条件：

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    active: true,
  })
  // 仅在具有冲突的电子邮件且活动为 true 时忽略。
  .onConflict(sql`(email) where active`)
  .ignore();
```

如果您改为在两列上定义内联主键，它将不会被 `onConflict` 接受。

对于 `merge` 和 `set`，您可以附加 [where](/zh-CN/guide/where) 以仅更新匹配的行数据：

```ts
const timestamp = Date.now();

db.table
  .create(data)
  .onConflict('email')
  .set({
    name: 'John Doe',
    updatedAt: timestamp,
  })
  .where({ updatedAt: { lt: timestamp } });
```

### onConflictIgnore

[//]: # 'has JSDoc'

使用 `onConflictIgnore` 抑制创建记录时的唯一约束违规错误。

在插入语句中添加 `ON CONFLICT (columns) DO NOTHING` 子句，列是可选的。

也可以接受约束名称。

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
  })
  // 在任何冲突时：
  .onConflictIgnore()
  // 或，对于特定列：
  .onConflictIgnore('email')
  // 或，对于特定约束：
  .onConflictIgnore({ constraint: 'unique_index_name' });
```

发生冲突时，无法从数据库返回任何内容，因此 `onConflictIgnore` 将在响应类型中添加 `| undefined` 部分。

```ts
const maybeRecord: RecordType | undefined = await db.table
  .create(data)
  .onConflictIgnore();

const maybeId: number | undefined = await db.table
  .get('id')
  .create(data)
  .onConflictIgnore();
```

创建多条记录时，仅返回创建的记录。如果没有记录被创建，数组将为空：

```ts
// 数组可能为空
const arr = await db.table.createMany([data, data, data]).onConflictIgnore();
```

### onConflict merge

[//]: # 'has JSDoc'

仅在 [onConflict](#onconflict) 之后可用。

使用此方法将您传递到 [create](#create-insert) 的所有数据合并，以在冲突时更新现有记录。

如果表具有具有**动态**默认值的列，也将应用此类值。

您可以通过传递 `except` 选项排除某些列不被合并。

```ts
// 合并完整数据
db.table.create(data).onConflict('email').merge();

// 仅合并单列
db.table.create(data).onConflict('email').merge('name');

// 合并多列
db.table.create(data).onConflict('email').merge(['name', 'quantity']);

// 合并除某些列之外的所有列
db.table
  .create(data)
  .onConflict('email')
  .merge({ except: ['name', 'quantity'] });

// 合并也可以应用于批量创建
db.table.createMany([data1, data2, data2]).onConflict('email').merge();

// 仅在某些条件下更新记录
db.table
  .create(data)
  .onConflict('email')
  .merge()
  .where({ ...certainConditions });
```

### onConflict set

[//]: # 'has JSDoc'

仅在 [onConflict](#onconflict) 之后可用。

在发生冲突时使用给定数据更新记录。

```ts
db.table.create(data).onConflict('column').set({
  description: 'setting different data on conflict',
});
```

`set` 可以接受原始 SQL 表达式：

```ts
db.table
  .create(data)
  .onConflict()
  .set(sql`raw SQL expression`);

// 仅在某些条件下更新记录
db.table
  .create(data)
  .onConflict('email')
  .set({ key: 'value' })
  .where({ ...certainConditions });
```

### defaults

[//]: # 'has JSDoc'

`defaults` 允许设置稍后将在 `create` 中使用的值。

在 `defaults` 中提供的列在后续 `create` 中标记为可选。

默认数据与 [create](#create-insert) 和 [createMany](#createMany-insertMany) 中相同，
因此您可以提供原始 SQL 或查询。

```ts
// 将使用 defaults 中的 firstName 和 create 参数中的 lastName：
db.table
  .defaults({
    firstName: 'first name',
    lastName: 'last name',
  })
  .create({
    lastName: 'override the last name',
  });
```

## update

[//]: # 'has JSDoc'

`update` 接受一个对象，其中包含要更新记录的列和值。

默认情况下，`update` 将返回更新记录的数量。

在 `update` 之前放置 `select`、`selectAll` 或 `get` 来指定返回的列。

您需要在调用 `update` 之前提供 `where`、`findBy` 或 `find` 条件。
为了确保不会意外更新整个表，没有条件的更新将在 TypeScript 和运行时中导致错误。

使用 `all()` 更新所有记录而无需条件：

```ts
await db.table.all().update({ name: 'new name' });
```

如果在更新之前指定了 `select` 和 `where`，它将返回更新记录的数组。

如果在更新之前指定了 `select` 和 `take`、`find` 或类似方法，它将返回一个更新记录。

对于列值，您可以提供特定值、原始 SQL、返回单个值的查询对象或带有子查询的回调。

允许从关系中选择单个值（请参阅下面的 `fromRelation` 列），
或对 JSON 列使用 [jsonSet](/zh-CN/guide/advanced-queries#jsonset)，
[jsonInsert](/zh-CN/guide/advanced-queries#jsoninsert)，
和 [jsonRemove](/zh-CN/guide/advanced-queries#jsonremove)（请参阅下面的 `jsonColumn`）。

```ts
import { sql } from './baseTable';

// 默认返回更新记录的数量
const updatedCount = await db.table
  .where({ name: 'old name' })
  .update({ name: 'new name' });

// 仅返回 `id`
const id = await db.table.find(1).get('id').update({ name: 'new name' });

// `selectAll` + `find` 将返回完整记录
const oneFullRecord = await db.table
  .selectAll()
  .find(1)
  .update({ name: 'new name' });

// `selectAll` + `where` 将返回完整记录的数组
const recordsArray = await db.table
  .select('id', 'name')
  .where({ id: 1 })
  .update({ name: 'new name' });

await db.table.where({ ...conditions }).update({
  // 将列设置为特定值
  column1: 123,

  // 使用自定义 SQL 更新列
  column2: () => sql`2 + 2`,

  // 使用返回单个值的查询
  // 返回多个值将导致 Postgres 错误
  column3: () => db.otherTable.get('someColumn'),

  // 从相关记录中选择单个值
  fromRelation: (q) => q.relatedTable.get('someColumn'),

  // 将新值设置到 JSON 列的 `.foo.bar` 路径
  jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
});
```

### sub-queries

除了简单选择单个值的子查询，还支持使用提供的 `create`、`update` 或 `delete` 子查询的结果更新列。

```ts
await db.table.where({ ...conditions }).update({
  // `column` 将设置为创建记录的 `otherColumn` 的值。
  column: () => db.otherTable.get('otherColumn').create({ ...data }),

  // `column2` 将设置为更新记录的 `otherColumn` 的值。
  column2: () =>
    db.otherTable
      .get('otherColumn')
      .findBy({ ...conditions })
      .update({ key: 'value' }),

  // `column3` 将设置为删除记录的 `otherColumn` 的值。
  column3: () =>
    db.otherTable
      .get('otherColumn')
      .findBy({ ...conditions })
      .delete(),
});
```

这是通过在底层定义 `WITH` 子句实现的，它生成这样的查询：

```sql
WITH q AS (
  INSERT INTO "otherTable"(col1, col2, col3)
  VALUES ('val1', 'val2', 'val3')
  RETURNING "otherTable"."selectedColumn"
)
UPDATE "table"
SET "column" = (SELECT * FROM "q")
```

查询是原子的，如果子查询失败，或者更新部分失败，或者如果子查询返回了多行，则数据库中不会保留任何更改。

虽然可以从回调中选择单个值以更新列：

```ts
await db.table.find(1).update({
  // 使用相关记录的 `two` 列的值更新列 `one`。
  one: (q) => q.relatedTable.get('two'),
});
```

但**不**支持在相关表上使用 `create`、`update` 或 `delete` 类型的子查询：

[//]: # 'TODO: can be supported using WITH shenanigans'

```ts
await db.table.find(1).update({
  // TS 错误，这是不允许的：
  one: (q) => q.relatedTable.get('two').create({ ...data }),
});
```

`update` 可用于 [with](/zh-CN/guide/advanced-queries#with) 表达式：

```ts
db.$queryBuilder
  // 更新一个表中的记录
  .with('a', db.table.find(1).select('id').update(data))
  // 使用第一个表记录 id 更新另一个表中的记录
  .with('b', (q) =>
    db.otherTable
      .find(1)
      .select('id')
      .update({
        ...otherData,
        aId: () => q.from('a').get('id'),
      }),
  )
  .from('b');
```

### null, undefined, unknown columns

- `null` 值将列设置为 `NULL`
- `undefined` 值将被忽略
- 未知列将被忽略

```ts
db.table.findBy({ id: 1 }).update({
  name: null, // 更新为 null
  age: undefined, // 跳过，无影响
  lalala: 123, // 跳过
});
```

### empty set

尝试使用空对象查询更新时，它将无缝转换为 `SELECT` 查询：

```ts
// 假设数据是一个空对象
const data = req.body;

// 查询转换为 `SELECT count(*) WHERE key = 'value'`
const count = await db.table.where({ key: 'value' }).update(data);

// 将按 id 选择完整记录
const record = await db.table.find(1).selectAll().update(data);

// 将按 id 选择单列
const name = await db.table.find(1).get('name').update(data);
```

如果表具有 `updatedAt` [时间戳](/zh-CN/guide/common-column-methods#timestamps)，即使对于空数据也会更新。

### updateSql

[//]: # 'has JSDoc'

`updateSql` 用于使用原始 SQL 表达式更新记录。

行为与常规 `update` 方法相同：
`find` 或 `where` 必须在调用此方法之前，
默认返回更新的数量，
您可以使用 `select` 自定义返回数据。

```ts
const value = 'new name';

// 使用 SQL 模板字符串更新
const updatedCount = await db.table.find(1).updateSql`name = ${value}`;

// 或使用 `sql` 函数更新：
await db.table.find(1).updateSql(sql`name = ${value}`);
```

### updateOrThrow

[//]: # 'has JSDoc'

确保至少更新了一行使用 `updateOrThrow`：

```ts
import { NotFoundError } from 'orchid-orm';

try {
  // updatedCount 保证大于 0
  const updatedCount = await db.table
    .where(conditions)
    .updateOrThrow({ name: 'name' });

  // updatedRecords 保证为非空数组
  const updatedRecords = await db.table
    .where(conditions)
    .select('id')
    .updateOrThrow({ name: 'name' });
} catch (err) {
  if (err instanceof NotFoundError) {
    // 处理错误
  }
}
```

## upsert

[//]: # 'has JSDoc'

`upsert` 尝试更新单条记录，然后如果记录尚不存在，则创建记录。

`find` 或 `findBy` 必须在 `upsert` 之前，因为它不适用于多个更新。

如果更新了多行，它将抛出 `MoreThanOneRowError` 并回滚事务。

它可以接受 `update` 和 `create` 对象，然后分别用于更新和创建查询。
或者，它可以接受 `data` 和 `create` 对象，`data` 将用于更新并与 `create` 对象混合。

`data` 和 `update` 对象与 `update` 方法期望的类型相同，`create` 对象是 `create` 方法参数的类型。

默认情况下不返回任何值，在 `upsert` 之前放置 `select` 或 `selectAll` 来指定返回的列。

```ts
await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      // 更新记录的名称
      name: 'new name',
    },
    create: {
      // 使用此电子邮件和名称 'new name' 创建新记录
      email: 'some@email.com',
    },
  });

// 与上面相同，但使用 `update` 和 `create`
await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    update: {
      name: 'updated user',
    },
    create: {
      email: 'some@email.com',
      // 在创建记录时使用不同的名称
      name: 'created user',
    },
  });
```

`create` 的数据可以从函数返回，如果记录已更新，则不会调用：

```ts
await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    update: {
      name: 'updated user',
    },
    create: () => ({
      email: 'some@email.com',
      name: 'created user',
    }),
  });

// 使用 `data` 的相同方式
await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      name: 'updated user',
    },
    create: () => ({
      email: 'some@email.com',
      // `create` 中的名称覆盖了 `data` 中的名称
      name: 'created user',
    }),
  });
```

来自 `data` 或 `update` 的数据传递到 `create` 函数并可以使用：

```ts
const user = await User.selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      name: 'updated user',
    },
    // `updateData` 具有与传递给 `data` 的内容完全相同的类型
    create: (updateData) => ({
      email: `${updateData.name}@email.com`,
    }),
  });
```

`upsert` 的工作方式与 [orCreate](#orCreate) 完全相同，但使用 `UPDATE` 语句而不是 `SELECT`。
它还执行单个查询（如果记录存在），以及两个查询（如果记录尚不存在）。

## increment

[//]: # 'has JSDoc'

将列增加 `1`，默认返回更新记录的数量。

```ts
const updatedCount = await db.table
  .where(...conditions)
  .increment('numericColumn');
```

使用 `find` 或 `get` 时，如果未找到记录将抛出 `NotFoundError`。

```ts
// 未找到时抛出错误
const updatedCount = await db.table.find(1).increment('numericColumn');

// 未找到时也抛出错误
const updatedCount2 = await db.table
  .where(...conditions)
  .get('columnName')
  .increment('numericColumn');
```

提供一个对象以增加多个列的不同值。
使用 `select` 指定返回的列。

```ts
// 将 someColumn 增加 5，otherColumn 增加 10，返回更新的记录
const result = await db.table
  .selectAll()
  .where(...conditions)
  .increment({
    someColumn: 5,
    otherColumn: 10,
  });
```

## decrement

[//]: # 'has JSDoc'

将列减少 `1`，默认返回更新记录的数量。

```ts
const updatedCount = await db.table
  .where(...conditions)
  .decrement('numericColumn');
```

使用 `find` 或 `get` 时，如果未找到记录将抛出 `NotFoundError`。

```ts
// 未找到时抛出错误
const updatedCount = await db.table.find(1).decrement('numericColumn');

// 未找到时也抛出错误
const updatedCount2 = await db.table
  .where(...conditions)
  .get('columnName')
  .decrement('numericColumn');
```

提供一个对象以减少多个列的不同值。
使用 `select` 指定返回的列。

```ts
// 将 someColumn 减少 5，otherColumn 减少 10，返回更新的记录
const result = await db.table
  .selectAll()
  .where(...conditions)
  .decrement({
    someColumn: 5,
    otherColumn: 10,
  });
```

## delete

[//]: # 'has JSDoc'

此方法删除一行或多行，基于查询中指定的其他条件。

默认情况下，`delete` 将返回删除记录的数量。

在 `delete` 之前放置 `select`、`selectAll` 或 `get` 来指定返回的列。

需要在调用 `delete` 之前提供 `where`、`findBy` 或 `find` 条件。
为了防止意外删除所有记录，没有条件的删除将在 TypeScript 和运行时中导致错误。

使用 `all()` 删除所有记录而无需条件：

```ts
await db.table.all().delete();
```

```ts
// deletedCount 是删除记录的数量
const deletedCount = await db.table.where(...conditions).delete();

// 返回单个值，如果未找到则抛出错误
const id: number | undefined = await db.table
  .findBy(...conditions)
  .get('id')
  .delete();

// 返回具有指定列的记录数组
const deletedRecord = await db.table
  .select('id', 'name', 'age')
  .where(...conditions)
  .delete();

// 返回完全删除的记录数组
const deletedUsersFull = await db.table
  .selectAll()
  .where(...conditions)
  .delete();
```

`delete` 支持连接，在底层连接被转换为 `USING` 和 `WHERE` 语句：

```ts
// 删除所有具有对应 profile 记录的用户：
db.table.join(Profile, 'profile.userId', 'user.id').all().delete();
```

`delete` 可用于 [with](/zh-CN/guide/advanced-queries#with) 表达式：

```ts
db.$queryBuilder
  // 删除一个表中的记录
  .with('a', db.table.find(1).select('id').delete())
  // 使用第一个表记录 id 删除另一个表中的记录
  .with('b', (q) =>
    db.otherTable.select('id').whereIn('aId', q.from('a').pluck('id')).delete(),
  )
  .from('b');
```
