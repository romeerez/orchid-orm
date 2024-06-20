---
'orchid-orm-valibot': minor
'orchid-orm-schema-to-zod': minor
'orchid-orm-test-factory': minor
'create-orchid-orm': minor
'test-utils': minor
'rake-db': minor
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

Change `text`, `varchar` types, remove `char` (#277)

The text no longer accepts min and max: `text(min, max)` -> `text()`

Varchar's limit becomes required: `varchar(limit?: number)` -> `varchar(limit: number)`
