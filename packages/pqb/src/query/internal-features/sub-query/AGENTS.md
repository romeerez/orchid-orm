# Sub-query Guidance

## Root query values

In a `select`, `where`, or `update` callback, the argument `q` is the root query, and its single value, such as `exists`, `get`, or an operator over them, is a value of the current record.
A condition or other query part that the callback adds to `q` must never be silently dropped when it can affect whether the current record matches or the value.
Parts that cannot affect a value of a single record, such as `order` and `distinct`, are ignored:

- Conditions, including added scopes, apply to the current record: the value is `NULL` or the default of the value, such as `false` for `exists`, when the record doesn't match them.
  Do not repeat conditions and scopes of the root query: they already apply to the current record.
- In `select`, such a value is a nested value query: `get` throws `NotFoundError` and `getOptional` returns `undefined` when the record doesn't match, a found `null` stays `null`.
- An aggregate method without `over` throws instead of becoming conditional on the record, pointing to its `filter` option.
  A window function and an arbitrary SQL function called with `fn`, including an aggregate one, apply the conditions like other values: do not classify functions called with `fn` by name.
- Joins, `limit`, `offset`, grouping, and unions cannot apply to the current record and throw.
- Every place that renders a value of `q`, including operands of operators and of `q.or`, renders it as a value of the current record with the conditions applied, never as an independent sub-query.
  Detect such a value by `rootBase` rather than by `subQuery`: the argument of a `having` callback is not a sub-query.
- A column reference created from `q`, such as by `ref` or `column`, throws when it is created once conditions or unsupported parts were added to `q`: it can be used in SQL and as an argument of a function, so it cannot represent a record that doesn't match while keeping the type of its column.
  Keep the error messages specific: pointing to `get` and `getOptional` for conditions, naming the unsupported part, or the strict usage such as `having`.
- A relation of `q` and `having`, including values used as operands of operators in `having`, throw once conditions or unsupported parts were added to `q`, because the meaning of the added parts is ambiguous there.

Detect added parts by reference against the root query parts remembered when `q` is passed to the callback: query methods replace the arrays of query data rather than mutate them.

Test each of `select`, `where`, `update`, `having`, and relation chains with SQL and against the database, with records that match and don't match the added conditions, and with conditions and scopes of the root query that must not be repeated.
