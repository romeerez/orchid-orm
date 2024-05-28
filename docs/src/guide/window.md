# Window functions

Various window functions are supported, and it's possible to call a custom one.

Each window function is accepting such options:

```ts
type WindowFnOptions =
  // Can be the name of a window defined by calling the .window() method,
  | WindowName
  // or object the same as the .window() method takes to define a window.
  | {
      // partition by one or multiple columns or SQL values
      partitionBy?: MaybeArray<ColumnName | RawSQL>;
      // the same order object as in the `order` method
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

Add a window with `window` and use it later by its name for aggregate or window functions:

```ts
db.table
  // define window `windowName`
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
      // calculate average price over the window
      q.avg('price', {
        // use window by its name
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
