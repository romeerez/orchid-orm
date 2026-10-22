# Get Feature Guidance

`get` and `getOptional` of a sub-query must return the same nested inside
`select` or on a relation as at the top level: when the outer record is not
found, `get` throws and `getOptional` returns `undefined`, and its type includes
`undefined`; a found `null` stays `null`. This holds for an aggregate sub-query
too: the aggregate always returns a row, but the outer record can still be not
found.

Nested in another query, a single-value query yields its value directly under
the selected key, not inside an object, wrapped into an array so that a not
found record differs from `null`. The SQL that wraps the value and the parsers
that unwrap it, including those of the selected sub-query, must agree for each
value query. That's why a sub-query value of a relation doesn't share a lateral
join with other values of that relation.

Test nested values with multi-character strings: unwrapping a string that
wasn't wrapped yields its first character. Cover a not found outer record
against a found `null`, both inside `select` and on a relation, for both a
column value and an aggregate sub-query.
