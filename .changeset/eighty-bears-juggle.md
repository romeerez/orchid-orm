---
'rake-db': patch
'pqb': patch
'orchid-core': patch
'orchid-orm': patch
---

Fix decimal, bigint, and similar columns loosing precision when returned in records from sub-selects (#459)
