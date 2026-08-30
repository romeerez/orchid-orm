# Select Feature Guidance

Selecting a scalar relation under a key that matches a source-column key must
still correlate the relation through the source column's database name. Treat
the relation's parent selection shape as a snapshot: later user-facing
selection aliases must not rewrite that correlation.

The collision regression belongs in the focused select tests and should cover
both generated SQL and execution, including an `assertType` assertion for the
returned aliased relation value.
