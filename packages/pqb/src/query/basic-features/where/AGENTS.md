# Where Guidance

Relation conditions stay in `and`, wrapped in `RelationCondition`, because code
that checks or copies `and` to find the conditions of a query must keep seeing
them. The SQL joins them by `AND` with the whole user condition, including
`orWhere` groups, and `clear('where')` keeps them. Test them in the ORM relation
tests.
