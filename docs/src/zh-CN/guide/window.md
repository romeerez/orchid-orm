# 窗口函数

支持多种窗口函数，并且可以调用自定义窗口函数。

每个窗口函数接受以下选项：

```ts
type WindowFnOptions =
  // 可以是通过调用 .window() 方法定义的窗口名称，
  | WindowName
  // 或与 .window() 方法用于定义窗口的对象相同。
  | {
      // 按一个或多个列或 SQL 值进行分区
      partitionBy?: MaybeArray<ColumnName | RawSQL>;
      // 与 `order` 方法中相同的排序对象
      order?:
        | {
            [columnName]:
              | 'ASC'
              | 'DESC'
              | 'ASC NULLS FIRST'
              | 'DESC NULLS LAST';
          }
        | RawExpression;
    };
```

## window

[//]: # 'has JSDoc'

使用 `window` 添加一个窗口，并通过其名称在聚合或窗口函数中使用：

```ts
db.table
  // 定义窗口 `windowName`
  .window({
    windowName: {
      partitionBy: 'someColumn',
      order: {
        id: 'DESC',
      },
    },
  })
  .select({
    avg: (q) =>
      // 计算窗口上的平均价格
      q.avg('price', {
        // 使用窗口名称
        over: 'windowName',
      }),
  });
```

## rowNumber

[//]: # 'has JSDoc'

Selects the` row_number` window function.

Returns the number of the current row within its partition, counting from 1.

```ts
// result is of type Array<{ rowNumber: number }>
const result = await db.table.select({
  rowNumber: (q) =>
    q.rowNumber({
      partitionBy: 'someColumn',
      order: { createdAt: 'ASC' },
    }),
});
```

## rank

[//]: # 'has JSDoc'

Selects the` rank` window function.

Returns the rank of the current row, with gaps; that is, the row_number of the first row in its peer group.

```ts
// result is of type Array<{ rank: number }>
const result = await db.table.select({
  rank: (q) =>
    q.rank({
      partitionBy: 'someColumn',
      order: { createdAt: 'ASC' },
    }),
});
```

## denseRank

[//]: # 'has JSDoc'

Selects the` dense_rank` window function.

Returns the rank of the current row, without gaps; this function effectively counts peer groups.

```ts
// result is of type Array<{ denseRank: number }>
const result = await db.table.select({
  denseRank: (q) =>
    q.denseRank({
      partitionBy: 'someColumn',
      order: { createdAt: 'ASC' },
    }),
});
```

## percentRank

[//]: # 'has JSDoc'

Selects the `percent_rank` window function.

Returns the relative rank of the current row, that is (rank - 1) / (total partition rows - 1). The value thus ranges from 0 to 1 inclusive.

```ts
// result is of type Array<{ percentRank: number }>
const result = await db.table.select({
  percentRank: (q) =>
    q.percentRank({
      partitionBy: 'someColumn',
      order: { createdAt: 'ASC' },
    }),
});
```

## cumeDist

[//]: # 'has JSDoc'

Selects the `cume_dist` window function.

Returns the cumulative distribution, that is (number of partition rows preceding or peers with current row) / (total partition rows). The value thus ranges from 1/N to 1.

```ts
// result is of type Array<{ cumeDist: number }>
const result = await db.table.select({
  cumeDist: (q) =>
    q.cumeDist({
      partitionBy: 'someColumn',
      order: { createdAt: 'ASC' },
    }),
});
```
