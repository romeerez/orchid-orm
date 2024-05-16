---
'pqb': patch
'orchid-orm': patch
---

Support using selected aggregated value of relation in `where`

```ts
await db.post
  .select({ commentsCount: (q) => q.comments.count() })
  // using `commentsCount` in the `where` wasn't supported previously:
  .where({ commentsCount: { gt: 5 } })
  .order({ commentsCount: 'DESC' });
```
