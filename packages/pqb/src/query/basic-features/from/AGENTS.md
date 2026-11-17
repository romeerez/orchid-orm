# `from` Guidance

A raw SQL expression or a table-less sub-query in `FROM` must be rendered with its alias wherever it is a source (`FROM`, a `JOIN` target, the `EXISTS` source of `whereExists`, the wrapper of a `select` sub-query returning one record or JSON), even when the query keeps the name of its table.

The columns declared in `fromSql` name the SQL result columns by position, the same way as in `withSql`.

When changing how sources are rendered, cover a `fromSql` query in each of those places, with exact SQL and the result from the database.

`fromSql` with columns called on a table keeps the table's `shape`: SQL rendering must resolve the columns of such a query by its `selectShape` and `selectAllShape`, never by the table `shape`. Cover it with a table that has a renamed column or a column cast for JSON.
