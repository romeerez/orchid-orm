---
'pqb': patch
'orchid-core': patch
'orchid-orm': patch
---

Override certain column types to be non-nullable after creating a _belongs to_ record that defines such columns.

```ts
// let's say a tree optionally belongs to a forest,
// a tree has a `forestId: number | null`

const tree = db.tree.create({
  name: 'Willow',
  forest: {
    name: 'Eerie forest',
  },
});

// ok, the `forestId` is not nullable
const num: number = tree.forestId;
```
