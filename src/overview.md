`sql` directory is for the code which is common for all sql databases.

`*.orm.ts`: main file for the ORM for the specific database. It is a top level interface, constructed with adapter, allows to perform queries, end db connection, to be used in `Repo`.

`*.adapter.ts`: is a middle layer between orm and specific library to connect to database, such as `mysql` or `mysql2` for mysql.

`*.model.ts`: an abstraction around single table, allows to define relations, perform queries.
