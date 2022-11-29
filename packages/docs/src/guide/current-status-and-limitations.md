# Current status and limitations

`Orchid ORM` status is somewhere in between of alpha and beta.
Despite thousands tests written, may have bugs, please drop an issue if you meet some.

Only Postgres database is supported for now.

Migrations are written by hand instead of generating them like in some other ORMs.

Relation models must be in a single database.

Relations support only a single column for primary and foreign key.

Raw query interpolation, such as `raw('a = $1 AND b = $2', [1, 2])` yet to be improved,
currently it only supports incrementing `$1`, `$2` variables, in future it will handle named parameters, question marks.

Support for `JOIN LATERAL` is in the plans, it will enable an interesting optimization of joining and selecting relations.

Cannot select record with relations in the `create`, `update`, and `delete` queries.

[Identity column](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-identity-column/) will be added soon.

No helpful methods available for `PostGis`, full text search, trigram search. Need to use raw SQL pieces for this.

Cannot customize error messages of the columns.

Range database types, composite custom types aren't supported.

There are some methods for searching in JSON columns, but just very basic, need more.

And there are like 20 less notable tasks in a todo list.
