---
'orchid-orm': patch
'pqb': patch
---

Add null-safe `isDistinctFrom` and `isNotDistinctFrom` condition operators that compile to Postgres `IS DISTINCT FROM` and `IS NOT DISTINCT FROM` comparisons. These operators make nullable column filtering available without manual `OR NULL` workarounds. (#723)
