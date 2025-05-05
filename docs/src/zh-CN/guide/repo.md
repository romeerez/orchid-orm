# 仓库

`Orchid ORM` 中的仓库是一个很棒的功能，它允许将复杂查询分解为更小的单一用途查询，并重用查询部分。

考虑以下示例，假设我们有一个用户表，它与 `followers` 关系关联，用于跟踪一个用户是否关注另一个用户。

在查询用户列表时，我们需要一个 id、名称、图片，以及一个布尔标志来判断当前授权用户是否关注该用户。

此外，我们希望通过检查子字符串是否包含 `firstName` 或 `lastName` 来搜索用户。

我们可以通过以下方式定义一个仓库：

```ts
import { createRepo } from 'orchid-orm';
import { db } from '../path-to-db';
import { User } from './user.table';
import { followRepo } from './follow.repo';

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectForList(q, currentUser: User) {
      return q.select('id', 'firstName', 'lastName', 'picture', {
        followed: (q) => followRepo(q.followers).isFollowedBy(currentUser),
      });
    },
    search(q, query: string) {
      return q.or(
        {
          firstName: {
            contains: query,
          },
        },
        {
          lastName: {
            contains: query,
          },
        },
      );
    },
  },
});
```

第一个参数 `createRepo` 是 `db.user`，它将在使用 `userRepo` 执行查询时默认使用。

`queryMethods` 的每个方法的第一个参数是类型为 `db.user` 的查询，该类型是之前提供的，无需显式指定。

当需要更多参数时，它们应该有一个类型。

仓库可以使用所有表功能，例如关系上的子查询。

注意 `followRepo` 如何在 `followed` 回调中使用，这样一个仓库可以使用另一个仓库来分离职责。

然后我们可以在代码的其他部分使用这个仓库：

```ts
const users = await userRepo
  .defaultSelect(currentUser)
  .search(query)
  .order({ createdAt: 'DESC' })
  .limit(20)
  .offset(20);

// 从仓库返回的响应是正确类型的
users[0].followed; // boolean
```

所有方法都变得可链式，第一个参数 `q` 在底层自动注入。

类型安全仍然得到保证，因此 `users` 是一个具有 id: number, firstName: string, following: boolean 等特定对象的数组。

目前，由于 TypeScript 的限制，无法在同一个仓库的方法中使用另一个方法，
但您可以使用 [makeHelper](/zh-CN/guide/query-methods#makeHelper) 提取一个函数来实现此目的：

```ts
const selectFollowing = db.user.makeHelper((q, currentUser: User) =>
  q.select({
    following: (q) => followRepo(q.followers).isFollowedBy(currentUser),
  }),
);

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectForList(q, currentUser: User) {
      return selectFollowing(
        q.select('id', 'firstName', 'lastName', 'picture'),
        currentUser,
      );
    },
    selectForView(q, currentUser: User) {
      return selectFollowing(
        q.select(
          'id',
          'firstName',
          'lastName',
          'picture',
          'bio',
          'someOtherFields',
        ),
        currentUser,
      );
    },
  },
});
```

## 方法种类

不同范围的方法可用：

```ts
export const repo = createRepo(db.table, {
  queryMethods: {
    queryMethod(q) {
      // q 可以是任何查询
      return q.select(...columns);
    },
  },
  queryOneMethods: {
    // q 是一个搜索单条记录的查询
    queryOneMethod(q) {
      return q.where(...conditions).update({
        relation: {
          // 嵌套创建仅在搜索单条记录时可用
          create: { ...relationData },
        },
      });
    },
  },
  queryWithWhereMethods: {
    // q 有 `where` 条件
    queryWithWhereMethod(q) {
      // .delete() 方法需要 `where`
      // 以避免错误删除所有记录
      return q.delete();
    },
  },
  queryOneWithWhereMethods: {
    // q 是一个带有 `where` 条件的查询，返回单条记录
    queryOneWithWhereMethods(q) {
      // .update() 方法需要 `where`
      // 以避免错误更新所有记录
      return q.update({
        relation: {
          // 嵌套创建仅在搜索单条记录时可用
          create: { ...relationData },
        },
      });
    },
  },
  methods: {
    // 没有查询参数，简单方法
    simpleMethod(a: number, b: number) {
      return a + b;
    },
  },
});
```

使用这些方法时，TypeScript 将检查查询是否满足方法参数：

```ts
// `queryMethods` 可用于任何类型的查询
repo.queryMethod();

// TS 错误
repo.queryOneMethod();
// 正确
repo.find(1).queryOneMethod();

// TS 错误
repo.queryWithWhereMethod();
// 正确
repo.where(...conditions).queryWithWhereMethod();

// TS 错误
repo.queryOneWithWhereMethod();
// 正确：find 返回一个并添加条件
repo.find(1).queryWithWhereMethod();

// 正确
repo.simpleMethod(1, 1);
```
