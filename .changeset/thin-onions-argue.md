---
'rake-db': minor
'orchid-orm': minor
'create-orchid-orm': patch
'pqb': patch
---

Rework migrations interface (#622)

Changing the way how to run migrations programmatically, see breaking changes and [Programmatic use](https://orchid-orm.netlify.app/guide/migration-programmatic-use.html).

Don't drop the schema specified in `rake-db` schema option when running migrations generator (#633).

If the `rake-db` schema option is specified, create all tables and other db objects in it.
