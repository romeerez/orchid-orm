---
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

Change behavior of `set` inside `update` in `hasMany` and `hasAndBelongsToMany` relations for when empty array or empty object is given.
Before, empty array/object was setting to all records, which is a bug.
Now, empty array/object means "set to no records".
It will nullify all connected records' foreign keys for `hasMany` and will delete all join table records for `hasAndBelongsToMany`.
