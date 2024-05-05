---
'create-orchid-orm': minor
'rake-db': minor
'orchid-orm': minor
---

Generate migrations from table files, see [generate migrations](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#generate-migrations) docs.

Rename utility type `Updateable` to `Updatable`.

Include `rake-db` migration toolkit to the `orchid-orm` package.
If you're using `orchid-orm`, remove `rake-db` from dependencies and import `rakeDb` from `orchd-orm/migrations` instead.
