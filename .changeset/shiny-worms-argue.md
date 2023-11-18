---
'rake-db': patch
'pqb': patch
'orchid-core': patch
'orchid-orm': patch
---

Change type of `Query.meta.defaults` from union of string literals to `Record<string, true>`, it is a more correct type for this case and it solves (#213)
