# Mutation filter safety

Mutation no trust fake where. `update`, `updateOrThrow`, `delete`, and `hardDelete` need real user condition, or user must say `all()`. Empty thing like `where({})`, `where({ id: undefined })`, or operator object where all values are `undefined` makes no SQL. Read query okay with that. Mutation query not okay.

## Files That Do Work

- [update.ts](./update.ts) and [delete.ts](./delete.ts) hold type mark `__hasWhere` and first runtime guard that only sees query metadata.
- [update.sql.ts](./update.sql.ts) and [delete.sql.ts](./delete.sql.ts) do real guard after where SQL is made.
- [soft-delete.ts](./soft-delete.ts) makes `delete()` become update, and makes `hardDelete()` remove hidden `nonDeleted` scope before normal delete SQL.
- [../where/where.sql.ts](../where/where.sql.ts) knows if final `WHERE` has real explicit predicate.
- [../where/where.ts](../where/where.ts) still marks where-like calls as `__hasWhere` for TypeScript, even when runtime later makes no predicate.

## Runtime Law

First guard is `throwIfNoWhere`. It catches mutation when query has no `and`, `or`, `scopes`, or `all` metadata. But this guard is dumb for dynamic filters: metadata can exist, then render no SQL.

So SQL builders give marker object to `whereToSql`. Marker gets set only when final where rendering makes real condition SQL.

If marker not set and no `all()`, bad mutation. `update.sql.ts` throws `Dangerous update without conditions`. `delete.sql.ts` throws `Dangerous delete without conditions`. This happens while making SQL, before database sees query. Same rule for row count, selected rows, and selected value mutations.

`all()` means user truly wants all visible rows. When `q.all` is set, later empty filters do not make query dangerous again. So `db.table.all().where({ id: undefined }).update(data)` is allowed.

## What Counts

Where renderer skips `undefined` values and empty operator objects. Those inputs can stay for reads, but they do not set mutation safety marker.

These count as real predicate when they render SQL: raw SQL expressions, existence predicates, relation joins that make `EXISTS`, non-empty `whereIn`, `find`, `findBy`, and named scopes that add conditions.

Empty `whereIn`-style inputs keep old safe behavior: they become `none()`. They must not become full-table mutations.

Scopes render late in `whereToSql`. Scope SQL can set marker, except built-in `default` and `nonDeleted` scopes. Those are hidden table behavior, not user mutation permission.

## Soft Delete

Soft-delete table has hidden `nonDeleted` scope. It renders `deletedAt IS NULL` by default. This limits visible rows, but it is implicit. It does not permit mutation by itself.

So `db.softTable.where({}).delete()` throws, even though soft delete update would include `deletedAt IS NULL`.

`all()` still permits mutating every non-deleted row. `hardDelete()` calls `_unscope(..., 'nonDeleted')` before delete SQL, so `all().hardDelete()` really deletes all rows visible after user scopes. `where({}).hardDelete()` still fails because no real explicit predicate.

## Gotchas

TypeScript marker and runtime marker ask different questions. `__hasWhere` means user called where-like API. Runtime marker means final rendered query has real explicit predicate after ignored values, empty objects, scopes, and soft-delete behavior are resolved.

`updateFrom` and `updateMany` skip explicit where marker check in `update.sql.ts` because generated `FROM` data or join conditions constrain mutation another way. Delete joins add `USING` and join conditions separately; when they make conditions, conditions are appended to rendered where SQL.
