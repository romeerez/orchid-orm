# Current status and limitations

Despite thousands tests written, may have bugs, please drop an issue if you encounter a one.

Supporting other than Postgres databases isn't planned: simply too much effort to support additional dbs,
focusing on ORM features and Postgres-specific features and optimizations instead.

It is limited to node-postgres only, supporting other Postgres adapters is in the plans.

You can use OrchidORM for the app connected to multiple databases, but it cannot manage table relations spread across databases.

Can select relations in create and update, but it is not yet supported in delete, upsert.

Supporting various useful extensions is in plans, but until implemented, you'll need to use raw SQL for this.
OrchidORM is designed the way that you can combine its existing functionality, and add just pieces of custom SQL where it is needed.

Range database types, composite custom types aren't supported.
It's not planned because it was not asked, drop an issue if you'd like to have it.

There are some methods for searching in JSON columns, but just very basic, needs more.
