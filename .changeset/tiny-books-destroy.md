---
'pqb': patch
---

Support query builder in `where` column callback:

```ts
db.user.where({
  firstName: (q) => q.ref('lastName'),
});
```
