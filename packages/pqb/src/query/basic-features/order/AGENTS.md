# Ordering

Keep dynamic sort fields inside quoted identifiers, even when runtime input
bypasses the selectable-column types.

Use SQL-only regression tests for both string and object sort arguments,
including unknown fields and qualified references containing double quotes.
Include another sort key after an injection payload to verify the full SQL.
