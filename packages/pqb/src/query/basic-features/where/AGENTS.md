# Where Guidance

Relation conditions stay in `and`, wrapped in `RelationCondition`, because code
that checks or copies `and` to find the conditions of a query must keep seeing
them. The SQL joins them by `AND` with the whole user condition, including
`orWhere` groups, and `clear('where')` keeps them. Test them in the ORM relation
tests.

## Empty `whereIn` lists

An empty list is a condition, not `none()`: an `orWhere` group can still match
records, while an explicit `none()` stays absolute. A query skips the database
only when the `and` group and every `or` group have the empty `whereIn`
condition, and never for `insert` and `upsert`, which must create records, or
with a CTE, which may write, or a union, which may add records. Do not skip a
relation load that must release the savepoint of its mutation.

An empty `whereNotIn` list must not permit `update` or `delete`: it renders no
SQL, and when its `and` or `or` group has no other conditions, the whole user
condition is left out of SQL.

Test each method with an empty list against the database together with other
conditions, `orCreate` and `upsert` with an existing matching record, and
`update` and `delete` with no other condition.
