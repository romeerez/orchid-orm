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
