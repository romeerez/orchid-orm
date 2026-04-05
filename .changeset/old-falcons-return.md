---
'orchid-orm': minor
'pqb': minor
---

Support selecting relations in delete queries (#679)

You can now load related data when deleting records:

```ts
const deleted = await db.order
  .find(orderId)
  .delete()
  .select('*', {
    items: (q) => q.orderItems,
  });
```

Unlike `create` and `update` which load relations in a follow-up query wrapped in a transaction, `delete` uses a CTE to capture relation data **before** the deletion, since the source rows will be gone afterward.