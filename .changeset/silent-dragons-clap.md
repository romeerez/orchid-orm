---
'orchid-orm': patch
'pqb': patch
---

Allow `get`, `getOptional`, and `pluck` to accept query-aware callbacks that return SQL expressions or single-value queries. This matches scalar selection behavior with existing `select` callback semantics, including relation scalar queries and expression helpers such as `q.ref` and `q.column` (#709)
