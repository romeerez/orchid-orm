# Select Feature Guidance

A value selected under a source-column key must not replace that column in the
selection shape: conditions, joins, windows, and relation loading resolve keys
through it. Conditions refer to a selected scalar relation by its key only when
no source column has that key; `get`, `pluck`, string selections, and aggregate
arguments refer to the relation either way. Resolve output aliases in the
query's `ORDER BY`; use source columns for ordering inside windows and
aggregates.

Selecting a scalar relation under a key that matches a source-column key must
still correlate the relation through the source column's database name. Treat
the relation's parent selection shape as a snapshot: later user-facing
selection aliases must not rewrite that correlation.

The collision regression belongs in the focused select tests and should cover
both generated SQL and execution, including an `assertType` assertion for the
returned aliased relation value.

When a CTE, a union, or a `from` sub-query selects a SQL computed column, the
outer query must reference it by its output key, which is the alias when it has
one, and must not compute it again: the source may not output the columns the
computed SQL depends on. The callback of a `join` of a sub-query is different:
its conditions are placed inside the sub-query and resolve columns against what
the sub-query reads, so a SQL computed column of a table still has to be
computed there. A value of `get` has no output key, so the outer query keeps
its computed SQL.

Test it per kind of source by asserting the exact SQL of the outer query and
executing it.
