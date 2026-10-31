# Chain Guidance

Preserve correlation with the parent query when `as` renames a chained query
or a repeated relation requires a distinct alias. Keep the conditions of every
step bound to the corresponding query.

Renaming or rendering a derived query must not change the aliases or conditions
of a reusable source query.

Test renamed aliases and repeated relations separately and together. Check SQL
and parent isolation for reads and mutations with records of another parent
present. Reuse the source query after executing a renamed query.
