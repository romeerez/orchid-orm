---
outline: deep
---

# 关系查询

## queryRelated

使用 `queryRelated` 为已加载的记录加载相关记录。

对于 `belongsTo` 和 `hasOne`，如果在其配置中未设置 `required: true`，结果可能为 undefined，这是默认值。

```ts
const book = await db.book.find(1);

// 第二个参数需要书籍的 `authorId`
const author = await db.book.queryRelated('author', book);

// 第二个参数需要作者的 id
const books = await db.author.queryRelated('books', author);

// 可以应用其他查询方法：
const countBooks: number = await db.author
  .queryRelated('books', author)
  .count();

const authorHasBooks: boolean = await db.author
  .queryRelated('books', author)
  .exists();
```

## chain

使用 `chain` 将查询链 "切换" 到其关系。

```ts
// 根据书籍 id 加载作者：
const author = await db.book.find(1).chain('author');

// 在单个查询中，根据书籍 id 加载作者的奖项：
const authorAwards = await db.book.find(1).chain('author').chain('awards');

// 查找多本书并加载它们的作者：
const manyAuthors = await db.book
  .where({ id: { in: [1, 2, 3] } })
  .chain('author');

// 同时过滤书籍和作者，并在一个查询中加载作者：
const filteredAuthors = await db.book
  .where({ booksCondition: '...' })
  .chain('author')
  .where({ authorCondition: '...' });

// 查找作者并加载他们的书籍：
const booksFromOneAuthor = await db.author.find(1).chain('books');

// 查找多个作者并加载他们的书籍：
const booksFromManyAuthors = await db.author
  .where({ id: { in: [1, 2, 3] } })
  .chain('books');

// 假设一本书有许多评论，
// 在一个查询中加载作者的书籍评论：
const bookReviews = await db.author
  .findBy({ name: '...' })
  .chain('books')
  .chain('reviews');

// 同时过滤作者和书籍，并在一个查询中加载书籍：
const filteredBooks = await db.author
  .where({ authorCondition: '...' })
  .chain('books')
  .where({ booksCondition: '...' });
```

## whereExist

任何关系都可以在 [whereExists](/zh-CN/guide/where.html#whereexists) 中使用：

```ts
// 加载有作者的书籍
await db.book.whereExists('author');

// 加载有书籍的作者
await db.authors.whereExists('book');

// 可以在回调中应用其他查询方法：
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Uladzimir Karatkievich' }),
);
```

## join

任何关系都可以在 [join](/zh-CN/guide/join.html#join-1) 中使用。

不推荐用于 `hasMany` 和 `hasAndBelongsToMany` 关系，
因为连接多个记录会导致主表值的重复。

```ts
await db.book.join('author').select(
  // 没有表的列是当前书籍表的列
  'title',
  // 选择连接表的列
  'author.name',
);

// 作者名称将为每个书籍标题重复：
await db.author.join('books').select('name', 'books.title');

// 可以在回调中应用其他查询方法：
await db.book
  .join('author', (q) => q.where({ 'author.name': 'Ayzek Asimov' }))
  .select('title', 'author.name');
```

## select

任何关系都可以在 `select` 的回调中加载，相关记录将添加到每个记录中。

`belongsTo` 和 `hasOne` 将添加一个对象（如果未找到，可以为 `null`，类型由关系配置中的 `required` 选项配置）。

`hasMany` 和 `hasAndBelongsToMany` 将添加一个对象数组。

对于 `hasMany` 和 `hasAndBelongsToMany`，这比 `join` 更好，因为它不会导致数据重复。

在回调中，可以为关系设置 `select`、`where`、`order`、`limit` 和其他方法。

```ts
// 类型将被推断，这仅用于演示。
type BookResult = {
  id: number;
  title: string;
  author: {
    id: number;
    name: number;
  };
};

const bookWithAuthor: BookResult = await db.book
  .select('id', 'title', {
    author: (q) => q.author.select('id', 'name'),
  })
  .take();

type AuthorResult = {
  id: number;
  name: string;
  books: {
    id: number;
    title: string[];
  };
};

const authorWithBooks: AuthorResult = await db.author
  .select('id', 'name', {
    books: (q) =>
      q.books
        .select('id', 'title')
        .where(...conditions)
        .order('title')
        .limit(5),
  })
  .take();
```

您可以在 `select` 回调中无限制地链接关系：

```ts
type BookResult = {
  id: number;
  title: string;
  author: {
    id: number;
    name: string;
    awards: {
      name: string;
      year: string;
    }[];
  };
};

const result: BookResult = await db.book
  .select('id', 'title', {
    author: (q) =>
      q.author.select('id', 'name', {
        awards: (q) => q.awards.select('name', 'year'),
      }),
  })
  .take();
```

使用 `exists()` 加载布尔值以了解是否存在相关记录。

```ts
type Result = {
  id: number;
  hasTags: boolean;
  hasSpecificTag: boolean;
};

const result: Result = await db.post.select('id', {
  hasTags: (q) => q.tags.exists(),
  hasSpecificTag: (q) => q.tags.where({ name: 'specific' }).exists(),
});
```

对于 `hasMany` 和 `hasAndBelongsToMany`，选择可以处理聚合查询，例如 `count`、`min`、`max`、`sum` 和 `avg`。
您可以在 `where` 和 `order` 中使用聚合选择的值。

```ts
type Result = {
  id: number;
  tagsCount: number;
  tagsCommaSeparated: string;
};

const result: Result = await db.post
  .select('id', {
    tagsCount: (q) => q.tags.count(),
    tagsCommaSeparated: (q) => q.tags.stringAgg('name', ', '),
  })
  .where({ tagsCount: { gt: 5 } })
  .order({ tagsCount: 'DESC' })
  .take();
```

### 内连接关系

如 [join: select relation](/zh-CN/guide/join#select-relation) 中所述，
如果您想过滤掉没有匹配关系的主表记录，可以在关系上设置空的 `join`：

```ts
// 仅加载至少有一本书出版年份在 2000 年之后的作者
const author = await db.author
  .select({
    books: (q) => q.books.join().where({ yearPublished: { gte: 2000 } }),
  })
  .take();

// `join()` 保证 `author.books` 不能为空
assert(author.books.length > 0);
```

### 选择同一表

关系选择可以深度嵌套并多次加载来自同一表的记录，而不会发生名称冲突。

例如，帖子有许多标签。
出于某种原因，我们想选择帖子、它们的标签、标签的帖子以及这些帖子的标签。

```ts
// 选择帖子
await db.post.select('*', {
  tags: (q) =>
    // 选择标签
    q.tags.select('*', {
      posts: (q) =>
        // 选择标签的帖子
        q.posts.select('*', {
          // 选择更深层次帖子的标签
          tags: (q) => q.tags,
        }),
    }),
});
```

在内部，更深层次的标签被连接为 `tags2`，更深层次的帖子被连接为 `posts2` 以避免名称冲突，
这在内部解决并完全隐藏。

您可以在选择关系后为其添加 `where` 条件，
这仅适用于 `belongsTo` 和 `hasOne` 关系。

因为 `hasMany` 和 `hasAndBelongsToMany` 关系作为 JSON 数组加载，
它们不能在选择后接受 `where` 条件。

在以下示例中，内部作者表在内部被别名为 `author2`，
条件 `author.name` 自动替换为 `author2.name`。

```ts
await db.author.select('*', {
  books: (q) =>
    q.books
      .select({
        // 内部选择为 author2
        author: (q) => q.author,
      })
      // 指的是 author2，而不是顶级作者
      .where({ 'author.name': 'Jack London' }),
});
```

## 创建 更新 删除

`Orchid ORM` 使修改相关记录变得简单，
它允许构建查询链以修改相关记录，
支持嵌套创建和更新。

对于 `belongsTo` 和 `hasOne`，每个关系只能执行一项操作。
例如，在创建书籍时创建作者，或在创建书籍时连接书籍到作者。
但不能同时创建和连接。

对于 `hasMany` 和 `hasAndBelongsToMany`，可以为单个关系组合多个命令：
在更新作者时，可以创建新书、连接一些书籍，并通过条件删除书籍。

### 创建

#### 在链中创建

可以通过查询表并创建其关系来链式操作，如下所示：

```ts
await db.author.find(id).chain('books').create({
  title: 'Book title',
});

// 帖子有许多标签
await db.post.find(id).chain('tags').create({
  name: 'tag name',
});
```

这适用于 `hasOne`、`hasMany` 和 `hasAndBelongsToMany`，但对于 `belongsTo` 和带有 `through` 选项的 `hasOne`/`hasMany` 是禁用的。

这仅允许基于返回一个记录的查询执行创建，
因此必须使用 `find`、`findBy`、`take` 或类似方法。

`db.post.tags.create` 或 `db.post.where(...).tags.create` 不会工作，因为这些查询返回多个帖子。

在这种链式查询中使用 `createMany` 或 `createRaw` 尚未实现，但已在计划中。

因为 `create` 方法设计为默认返回完整记录，
在使用条件未找到记录的情况下，即使使用 `findOptional` 也会抛出 `NotFoundError`：

```ts
// 如果没有具有这样的标题的帖子，将抛出错误
await db.post
  .findBy({ title: 'non-existing' })
  .chain('tags')
  .create({ name: 'tag name' });

// 也会抛出错误
const tag = await db.post
  .findByOptional({ title: 'non-existing' })
  .chain('tags')
  .create({ name: 'tag name' });

// 我们可以确保标签始终返回
tag.name;
```

如果希望返回 `undefined` 而不是抛出 `NotFoundError`，
使用 `takeOptional()` 获取 `RecordType | undefined`，或使用 `count()` 获取未找到时的 0 和创建时的 1。

`hasAndBelowToMany` 关系无论如何都会抛出 `NotFoundError`，
以确保我们不会创建未连接到其他记录的悬挂记录。

```ts
const tagOrUndefined = await db.author
  .findByOptional({ name: 'Author name' })
  .chain('books')
  .takeOptional()
  .create({ name: 'Book title' });

const createdCount = await db.author
  .findByOptional({ name: 'Author name' })
  .chain('books')
  .count()
  .create({ name: 'Book title' });

// hasAndBelongsToMany 无论如何都会抛出错误：
await db.post
  .findByOptional({ title: 'Post title' })
  .chain('tags')
  .takeOptional()
  .create({ name: 'tag name' });
```

#### 嵌套创建

一次性创建记录及其相关记录：

这将在事务中运行两个插入查询，（在 `hasAndBelongsToMany` 的情况下运行三个插入查询）。

对于带有 `through` 选项的关系需要显式嵌套 `creates`。

如果帖子表通过 "postTags" 有许多标签，需要创建帖子，在其中创建 postTags，然后在其中创建标签。

但如果您对 `hasAndBelongsToMany` 执行相同的关系，可以直接从帖子创建中创建标签，
并且中间的 postTag 记录将自动创建。

```ts
const book = await db.book.create({
  title: 'Book title',
  author: {
    create: {
      name: 'Author',
    },
  },
});

const author = await db.author.create({
  name: 'Author',
  books: {
    create: [{ title: 'Book 1' }, { title: 'Book 2' }, { title: 'Book 3' }],
  },
});

// 帖子通过 postTags 有许多标签
// 我们不能直接创建标签
const post = await db.post.create({
  title: 'Post title',
  postTags: {
    create: [
      {
        tag: {
          create: {
            name: 'tag name',
          },
        },
      },
    ],
  },
});
```

嵌套创建也支持在创建多个时：

```ts
const books = await db.book.createMany([
  {
    title: 'Book 1',
    author: {
      create: {
        name: 'Author 1',
      },
    },
  },
  {
    title: 'Book 2',
    author: {
      create: {
        name: 'Author 2',
      },
    },
  },
]);
```

#### 从更新中创建

在执行更新时创建相关记录：

对于 `belongsTo`、`hasOne` 和 `hasMany`，在更新一个记录时可用，必须在更新之前有 `find`、`findBy` 或 `take`。

对于 `hasAndBelongsToMany`，这将连接所有找到的记录以进行更新与所有创建的记录。

`hasOne` 关系将使前一个相关记录的 `foreignKey` 为空（如果存在），因此它必须是可为空的。

```ts
await db.book.find(1).update({
  title: 'update book title',
  author: {
    create: {
      name: 'new author',
    },
  },
});

await db.author.find(1).update({
  name: 'update author name',
  books: {
    create: [{ title: 'new book 1' }, { title: 'new book 2' }],
  },
});

// 这将连接所有 3 个帖子与 2 个标签
await db.post.where({ id: { in: [1, 2, 3] } }).update({
  tags: {
    create: [{ name: 'new tag 1' }, { name: 'new tag 2' }],
  },
});
```

对于 `belongsTo`，在更新多个记录时，`create` 选项将连接新记录与所有更新记录：

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  title: 'update book title',
  author: {
    // 所有书籍将与此作者连接：
    create: {
      name: 'new author',
    },
  },
});
```

### 更新

#### 嵌套更新

更新相关记录。

`belongsTo` 和 `hasOne` 接受带有更新数据的对象。

`hasMany` 和 `hasAndBelongsToMany` 接受 `where` 条件和 `data` 对象。`where` 可以是对象或对象数组。

```ts
await db.book.find(1).update({
  author: {
    update: {
      name: 'new name',
    },
  },
});

await db.author.find(1).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      },
    },
  },
});
```

在更新多个记录时，所有相关记录都将被更新：

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  author: {
    update: {
      name: 'new name',
    },
  },
});

await db.author.where({ id: [1, 2, 3] }).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      },
    },
  },
});
```

### upsert: 更新或插入

如果存在则更新相关记录，如果不存在则创建。

仅适用于 `belongsTo` 和 `hasOne` 关系。

在批量更新中仅支持 `belongsTo`。

```ts
await db.book.find(1).update({
  author: {
    upsert: {
      update: {
        name: 'new name',
      },
      create: {
        name: 'new name',
        email: 'some@email.com',
      },
    },
  },
});
```

`create` 数据可以从回调返回，仅在未找到相关记录进行更新时调用：

```ts
await db.book.find(1).update({
  author: {
    upsert: {
      update: {
        name: 'new name',
      },
      create: () => ({
        name: 'new name',
        email: 'some@email.com',
      }),
    },
  },
});
```

### 删除

#### 在链中删除

从关系查询链中删除相关记录。

这适用于所有类型的关系，除了 `belongsTo`。

```ts
// 删除作者的所有书籍
await db.author.find(1).books.all().delete();

// 删除特定作者的特定书籍
await db.author
  .where({ name: 'author name' })
  .chain('books')
  .where({ title: 'book title' })
  .delete();

// TypeScript 将突出显示 `delete` 方法
// 因为不允许删除 `belongsTo` 关系
await db.book.find(1).chain('author').delete();
```

### 在更新中删除

删除相关记录。

对于 `belongsTo` 关系，它将在删除之前将 `foreignKey` 更新为 `NULL`。

`hasMany` 和 `hasAndBelongsToMany` 接受与 `.where` 方法相同的条件以仅删除匹配的记录，作为对象或对象数组。

空的 `{}` 或 `[]` 将删除所有相关记录。

```ts
await db.book.find(1).update({
  author: {
    delete: true,
  },
});

await db.author.find(1).update({
  account: {
    // 根据条件删除作者书籍
    delete: { title: 'book title' },
  },
});

await db.author.find(1).update({
  account: {
    // 条件数组：
    delete: [{ id: 1 }, { id: 2 }],
  },
});
```

## 连接和断开连接

任何关系都支持 `connect` 和 `connectOrCreate` 在创建时连接相关记录，
以及在更新时的不同接口。

### 创建时

#### 连接

对于任何类型的关系，`connect` 根据给定条件搜索记录并连接它们。
如果未找到记录，则抛出 `NotFoundError`。

```ts
const book = await db.book.create({
  title: 'Book title',
  author: {
    connect: {
      name: 'Author',
    },
  },
});

const author = await db.author.create({
  name: 'Author name',
  books: {
    connect: [
      {
        title: 'Book 1',
      },
      {
        title: 'Book 2',
      },
    ],
  },
});
```

#### connectOrCreate

`connectOrCreate` 选项根据给定条件搜索记录，
如果未找到则创建新记录。

`belongsTo` 和 `hasOne` 接受单个 `{ where: ..., create ... }`：

```ts
const result = await db.book.create({
  title: 'Book title',
  author: {
    connectOrCreate: {
      where: {
        name: 'Author',
      },
      create: {
        name: 'Author',
      },
    },
  },
});
```

`hasMany` 和 `hasAndBelongsToMany` 接受 `{ where: ..., create ... }` 的数组：

```ts
const result = await db.author.create({
  name: 'Author',
  books: {
    connectOrCreate: [
      {
        where: { title: 'Book 1' },
        create: { title: 'Book 1' },
      },
      {
        where: { title: 'Book 2' },
        create: { title: 'Book 2' },
      },
    ],
  },
});
```

### 更新时

#### 设置

`set` 断开现有相关记录并连接新的记录。

对于 `hasOne` 和 `hasMany`，仅在更新一个记录时可用，
查询必须在更新之前有 `find`、`findBy` 或 `take`。

`hasOne` 和 `hasMany` 通过将引用列置为空来断开现有记录，因此列必须是可为空的。

`hasAndBelongsToMany` 删除现有的连接记录并创建新的记录。

所有关系类型在更新单个记录时支持 `set`，
仅 `belongsTo` 和 `hasAndBelongsToMany` 在批量更新中支持 `set`。

`belongsTo` 和 `hasOne` 期望用于搜索的单个对象，
`hasMany` 和 `hasAndBelongsToMany` 期望单个对象或数组。

将空数组设置为 `hasMany` 或 `hasAndBelongsToMany` 关系将断开所有记录。

```ts
const author = await db.author.find(1);

// 这将使用给定对象中的作者 id 更新书籍
await db.book.find(1).update({
  author: {
    set: author,
  },
});

// 这将找到具有给定条件的第一个作者以使用其 id
await db.book.find(2).update({
  author: {
    set: { name: 'author name' },
  },
});

// TypeScript 错误，因为需要使用 `findBy` 而不是 `where`：
await db.author.where({ id: 1 }).update({
  books: {
    set: { id: 1 },
  },
});

await db.author.find(1).update({
  books: {
    // 所有找到的具有这些标题的书籍将连接到作者
    set: { title: 'book title' },
  },
});

await db.author.find(1).update({
  books: {
    // 可以提供条件数组：
    set: [{ id: 1 }, { id: 2 }],
  },
});

// 对于 `hasMany`，这将使所有相关书籍的 `authorId` 为空，
// 对于 `hasAndBelongsToMany`，这将删除所有相关的连接表记录。
await db.author.find(1).update({
  books: {
    set: [],
  },
});
```

#### 添加

使用 `add` 在 `hasMany` 和 `hasAndBelongsToMany` 中连接更多记录，而不断开已经连接的记录。

对于 `hasMany`，仅在更新单个记录时可用，
在 `hasAndBelongsToMany` 中，它也适用于批量更新。

```ts
await db.author.find(1).update({
  books: {
    add: { id: 1 },
    // 或数组：
    add: [{ id: 1 }, { id: 2 }],
  },
});
```

在以下示例中，两个标签被添加到所有具有特定标题的帖子。

- 如果通过相同条件（名称为 'javascript'）找到多个标签（2 个标签），所有这些标签将被连接。
- 如果找到的标签少于数组长度（示例中为 2），将抛出错误。

```ts
await db.post.where({ title: { contains: 'node.js' } }).update({
  tags: {
    add: [{ name: 'javascript' }, { name: 'programming' }],
  },
});
```

#### 断开相关记录

这将删除 `hasAndBelongsToMany` 的连接表记录，并将其他类型的 `foreignKey` 列置为空（列必须是可为空的）。

在创建多个记录时也支持。

对于 `belongsTo` 和 `hasOne` 关系，写 `disconnect: true`：

```ts
await db.book.where({ title: 'book title' }).update({
  author: {
    disconnect: true,
  },
});
```

`hasMany` 和 `hasAndBelongsToMany` 关系接受过滤条件。

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: {
      name: 'some tag',
    },
  },
});
```

它可以是条件数组：

每个提供的条件可以匹配 0 或更多相关记录，没有检查以找到确切的一个。

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: [{ id: 1 }, { id: 2 }],
  },
});
```
