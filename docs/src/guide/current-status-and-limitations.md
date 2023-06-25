# Current status and limitations

`Orchid ORM` status is somewhere in between of alpha and beta.
Despite thousands tests written, may have bugs, please drop an issue if you meet some.

Only Postgres database is supported for now.

Migrations are written by hand instead of generating them like in some other ORMs.

To perform relation queries, related tables currently must be in a single database.

Relations support only a single column for primary and foreign key.

Cannot select record with relations in the `create`, `update`, and `delete` queries.

No helpful methods available for `PostGis`, full text search, trigram search. Need to use raw SQL pieces for this.

Range database types, composite custom types aren't supported.

There are some methods for searching in JSON columns, but just very basic, need more.
