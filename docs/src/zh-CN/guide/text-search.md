# 全文搜索

`Orchid ORM` 支持 Postgres 的[全文搜索](https://www.postgresql.org/docs/current/textsearch.html)的所有主要功能。

为了保持性能，定义一个[生成的](/zh-CN/guide/migration-column-methods#generated) `tsvector` 列，并创建一个特殊的[搜索索引](/zh-CN/guide/migration-column-methods#searchindex)。

## 语言

[//]: # 'has JSDoc'

默认情况下，搜索语言是英语。

您可以在 `createBaseTable` 配置中设置不同的默认语言：

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  language: 'swedish',
});
```

使用以下 SQL 查看支持的语言配置列表：

```sql
SELECT cfgname FROM pg_ts_config;
```

当执行搜索时，您可以覆盖默认语言：

```ts
db.table.search({
  language: 'finnish',
  in: 'body',
  query: 'query',
});
```

`language` 也接受原始 SQL。

语言可以存储在此表的列中，然后您可以使用 `languageColumn` 来使用此列进行搜索：

```ts
db.table.search({
  // 表有 `lang` 列，使用它进行搜索
  languageColumn: 'lang',
  in: 'body',
  query: 'query',
});
```

## 搜索的文本向量

[//]: # 'has JSDoc'

搜索的文本可以是简单的字符串、原始 SQL、文本列或多个列：

```ts
db.table.search({
  // 在给定字符串中搜索
  text: 'simply a string to search in',
  query: 'query',
});

import { raw } from 'orchid-orm';

db.table.search({
  // 原始 SQL：用空格连接文本列
  text: raw`concat_ws(' ', title, body)`,
  query: 'query',
});

db.table.search({
  // 在单个文本列中搜索
  in: 'body',
  query: 'query',
});

db.table.search({
  // 在多个列中搜索，它们用 `concat_ws` 连接，如上所示
  in: ['title', 'body'],
  query: 'query',
});

db.table.search({
  // 在具有不同权重的多个列中搜索。权重可以是 A、B、C 或 D
  in: {
    title: 'A',
    body: 'B',
  },
  query: 'query',
});
```

为了更好的性能，定义一个 `tsvector` 类型的[生成的](/zh-CN/guide/migration-column-methods#generated)列，并在搜索中使用 `vector` 关键字：

```ts
db.table.search({
  vector: 'titleAndBodyVector',
  query: 'query',
});
```

## 搜索查询

[//]: # 'has JSDoc'

在[此 Postgres 文档](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES)中了解不同的搜索查询。

`search` 方法可以接受以下查询之一：

- `query`：对应于 Postgres 中的 `websearch_to_tsquery`，默认使用
- `plainQuery`：对应于 `plainto_tsquery`
- `phraseQuery`：对应于 `phraseto_tsquery`
- `tsQuery`：对应于 `to_tsquery`

`query`（`websearch_to_tsquery`）可以处理任何用户输入，而其他查询类型需要特定格式，对于无效输入会失败。

每种查询类型都接受字符串或原始 SQL。

```ts
import { raw } from 'orchid-orm';

db.table.search({
  vector: 'titleAndBodyVector',
  // 可以接受原始 SQL：
  phraseQuery: raw`'The Fat Rats'`,
});
```

## 按搜索排名排序

[//]: # 'has JSDoc'

在[此 Postgres 文档](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING)中了解搜索排名。

设置 `order: true` 按搜索排名排序结果：

```ts
db.table.search({
  in: 'body',
  query: 'query',
  // 将添加 ORDER BY ts_rank(to_tsvector('english', body)) DESC
  order: true,
});
```

要使用 `ts_rank_cd` 而不是 `ts_rank` 排序，请设置 `coverDensity: true`：

```ts
db.table.search({
  in: 'body',
  query: 'query',
  // 将添加 ORDER BY ts_rank_cd(to_tsvector('english', body)) DESC
  order: {
    coverDensity: true,
  },
});
```

其他选项是：

```ts
db.table.search({
  in: 'body',
  query: 'query',
  order: {
    // D、C、B、A 的权重：
    weights: [0.1, 0.2, 0.4, 1],
    // 默认情况下，排名忽略文档长度
    // 通过提供特殊数字更改排名行为
    normalization: 32,
    // 可以更改排序方向：
    dir: 'ASC', // 默认是 DESC
  },
});
```

为搜索提供 `as` 别名可以在 `order` 方法中设置排序：

```ts
db.table
  .search({
    as: 'search',
    in: 'body',
    query: 'query',
  })
  .order({
    // 可以是 `search: true` 默认值
    search: {
      // 与上面相同的选项
      coverDensity: true,
      weights: [0.1, 0.2, 0.4, 1.0],
      normalization: 32,
      dir: 'ASC',
    },
  });
```

## 选择高亮文本

[//]: # 'has JSDoc'

为搜索提供 `as` 别名，可以选择带有匹配单词或短语高亮的文本：

```ts
db.table
  .search({
    as: 'search',
    in: 'body',
    query: 'query',
  })
  .select({
    highlightedText: (q) => q.headline('search'),
  });
```

当在生成的 `tsvector` 列中搜索时，需要为 `headline` 提供文本来源：

```ts
db.table
  .search({
    as: 'search',
    vector: 'textVector',
    query: 'query',
  })
  .select({
    // `body` 是列名
    highlightedText: (q) => q.headline('search', { text: 'body' }),
  });
```

`text` 可以是原始 SQL，这里我们连接多个列：

```ts
import { raw } from 'orchid-orm';

db.table
  .search({
    as: 'search',
    vector: 'titleAndBodyVector',
    query: 'query',
  })
  .select({
    highlightedText: (q) =>
      q.headline('search', { text: raw`concat_ws(' ', title, body)` }),
  });
```

`headline` 支持 `options` 的字符串，详细信息请参阅[Postgres 文档](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-HEADLINE)。

提供简单字符串或原始 SQL：

```ts
db.table
  .search({
    as: 'search',
    in: 'body',
    query: 'query',
  })
  .select({
    highlightedText: (q) =>
      q.headline('search', {
        options:
          'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<, StopSel=>>',
      }),
  });
```
