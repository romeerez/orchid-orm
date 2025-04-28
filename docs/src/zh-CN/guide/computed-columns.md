# 计算列

OrchidORM 支持定义动态计算的列，
可以通过在 `SELECT` 语句中注入 SQL，或者在 JS 运行时计算值。

请注意，与常规列不同，计算列默认不会被选择。

或者，你可以在迁移中添加一个生成列（参见[生成列](/zh-CN/guide/migration-column-methods#generated-column)），
此类列将持久存储在数据库中。

## SQL 计算列

SQL 计算列在从表中选择时会展开为给定的 SQL。

在以下示例中，选择 `fullName` 将展开为 `"firstName" || ' ' || "lastName"` SQL：

```ts
import { BaseTable, sql } from './baseTable';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed((q) => ({
    fullName: sql`${q.column('firstName')} || ' ' || ${q.column(
      'lastName',
    )}`.type((t) => t.string()),
    randomizedName: sql(
      () => sql`${Math.random()} ${q.column('firstName')}`,
    ).type((t) => t.string()),
  }));
}
```

示例中的 `randomizedName` 使用 `` sql(() => sql`...`) `` 语法定义，
使其具有动态性，因此每次查询都会选择一个新的随机值。

此类列可以被选择、用于过滤和排序，并且在嵌套子查询中可用。

```ts
// 选择所有列 + 计算列
db.user.select('*', 'fullName')

// 在嵌套选择中使用
db.chat.find(id).select({
  messages: (q) => q.messages.select({
    // 为单行选择 fullName
    sender: (q) => q.sender.select('fullName')
    // `pluck` 将加载一个扁平的值数组
    receipients: (q) =>
      q.receipients
        .pluck('fullName')
        // 支持过滤
        .where({ fullName: { startsWith: 'x' } })
        // 支持排序
        .order('fullName'),
  })
})

// 可以为连接的表选择
db.post.join('author').select('author.fullName')

// 可以从 `insert`、`create`、`update`、`delete`、`upsert` 返回
db.user.select('fullName').insert(data)
```

## JS 运行时计算

定义一个运行时计算列以在加载结果后计算值。

与 SQL 计算列不同，这些列不适合用于过滤或排序记录，仅可用于选择。

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed((q) => ({
    fullName: q.computeAtRuntime(
      // 定义其依赖的列
      ['firstName', 'lastName'],
      // 回调中仅可用上面定义的列
      (record) => `${record.firstName} ${record.lastName}`,
    ),
  }));
}
```

运行时计算列在所有类型的选择中可用。

如果未选择依赖项，它将自动选择依赖项，
并在计算值后丢弃未选择的依赖项。

```ts
const record = await db.user.select('firstName', 'fullName');
record.firstName; // 已选择
record.fullName; // 已计算
record.lastName; // TS 错误：它已被选择但随后被丢弃

db.char.find(id).select({
  messages: (q) => q.messages.select({
    // 为单行选择 fullName
    sender: (q) => q.sender.select('fullName')
    // `pluck` 将收集一个扁平的值数组
    receipients: (q) => q.receipients.pluck('fullName')
  })
})

// 可以为连接的表选择
db.post.join('author').select('author.fullName')

// 可以从 `insert`、`create`、`update`、`delete`、`upsert` 返回
db.user.select('fullName').insert(data)
```

## 异步计算列

逐个异步获取记录的数据会耗费大量加载时间，
更好的方式是批量加载数据。

```ts
interface WeatherData {
  country: string;
  city: string;
  weatherInfo: SomeStructure;
}

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    country: t.string(),
    city: t.string(),
  }));

  computed = this.setComputed((q) => ({
    weather: q.computeBatchAtRuntime(
      // 定义其依赖的列
      ['country', 'city'],
      // 使用单次获取为所有用户加载天气数据
      async (users): Promise<(SomeStructure | undefined)[]> => {
        // 避免重复查询相同位置
        const uniqueLocations = new Set(
          users.map((user) => `${user.country} ${user.city}`),
        );

        // 一次性获取所有位置的数据
        const weatherData: WeatherData[] = await fetchWeatherData({
          location: [...uniqueLocations],
        });

        // 返回每个用户的天气数据数组
        return users.map(
          (user) =>
            weatherData.find(
              (wd) => wd.country === user.country && wd.city === user.city,
            )?.weatherInfo,
        );
      },
    ),
  }));
}
```

`computeBatchAtRuntime` 也可以接受同步函数。

从查询的角度来看，与 [computeAtRuntime](#js-运行时计算) 列没有区别，
它的工作方式和行为完全相同。

```ts
db.user.select('*', 'weather');

// 一个城市可能有数百万人，
// 但天气数据只加载一次
db.city.find(id).select({
  users: (q) => q.users.select('name', 'weather'),
});
```

即使加载嵌套查询时，也只处理一批记录。

假设我们有 10 个国家，每个国家有 10 个城市，每个城市有 100 个用户。

`weather` 计算列只会被调用一次，处理 10,000 条记录。

```ts
db.country.select({
  cities: (q) =>
    q.cities.select({
      users: (q) => q.users.select('name', 'weather'),
    }),
});
```

一个城市可能有市长，但并非总是如此。
当将数据传递给计算列时，空记录会被忽略。

```ts
db.country.select({
  cities: (q) =>
    q.cities.select({
      // 城市可能有一个市长，但不是必须的
      mayor: (q) => q.mayor.select('name', 'weather'),
    }),
});
```
