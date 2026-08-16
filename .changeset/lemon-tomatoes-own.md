---
'orchid-orm': minor
'pqb': minor
---

Optimize and slightly change HABTM and hasMany operations in nested update/create (#87).

Nested `hasMany` and `hasAndBelongsToMany` creates and updates can combine supported operations; updates accept multiple update groups and nested upserts.
Parent upsert branches support the respective nested operations, and nested updates respect relation connections changed in the same payload.
