# None Feature Guidance

A `none` query never queries the database, aggregates included: `count`
resolves to `0` and other aggregates to `null`. A grouped or `having`-filtered
aggregate, a window function, and an aggregate compared by an operator aren't
evaluated: at the top level, they resolve as not found.

These values must not depend on whether `none` is called before or after the
aggregate, such as `none().count()` and `count().none()`.

Test both orders at the top level, asserting that no query is sent, and inside
`select` against the database. Inside `select`, include an aggregate of a
decimal column: it has no parser that would turn a missing value into `null`.
