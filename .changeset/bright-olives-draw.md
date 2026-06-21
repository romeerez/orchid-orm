---
'orchid-orm': patch
'pqb': patch
---

Add `generatorIgnore = true` on table and view class definitions to keep them queryable while excluding their DDL from generated migrations (#716)
