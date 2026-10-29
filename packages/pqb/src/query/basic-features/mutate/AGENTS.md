# Mutation Guidance

## Mutation without conditions

`update`, `updateOrThrow`, `delete`, and `hardDelete` require a condition that
limits the records, or `all()`. Conditions that render no SQL, such as
`where({})`, `where({ id: undefined })`, or an operator object of `undefined`
values, don't count, while read queries accept them. Decide this by the
rendered `WHERE`, not by the query data or the `__hasWhere` type flag: dynamic
filters stay in the query data and render nothing.

`all()` permits changing all visible records, and empty filters added after it
don't revoke the permission.

The `default` and `nonDeleted` scopes limit the records implicitly, so they
don't permit a mutation, while named scopes that add conditions do, unless an
empty `notIn` list makes them match all records. So `where({}).delete()` of a
soft-delete table throws, though its update has the `deletedAt IS NULL`
condition. `hardDelete()` removes the `nonDeleted` scope
first, so `all().hardDelete()` deletes all records visible after user scopes.

`updateFrom` and `updateMany` skip the check: their `FROM` data limits the
records. `delete` with a `join` skips it only when the join renders conditions.

The check runs while building the SQL, so test a rejected mutation with
`toSQL()`.
