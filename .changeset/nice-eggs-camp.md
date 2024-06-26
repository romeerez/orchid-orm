---
'rake-db': minor
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

Improve column casting to snake case in migrations and code gen:

When the `snakeCase` option is enabled, columns can be written in camelCase in all contexts,
and will be translated to snake_case.

This includes columns in primary keys, indexes, foreign keys options.
