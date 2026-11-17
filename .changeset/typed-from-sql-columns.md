---
'pqb': patch
'orchid-orm': patch
---

Support declaring columns in `fromSql` to get a typed query usable as a table in `join`, `whereExists`, `whereIn`, and sub-queries. Fix `whereExists` resolving a column selected under an alias as a table column (#902)
