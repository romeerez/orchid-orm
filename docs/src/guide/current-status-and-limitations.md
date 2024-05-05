# Current status and limitations

Despite thousands tests written, may have bugs, please drop an issue if you encounter a one.

Supporting other than Postgres databases isn't planned.
Because Postgres is a rabbit whole that has extensions for anything you can imagine:
PostGis, extensions that can replace ElasticSearch, extensions for message queues that can replace tools such as SQS/RabbitMQ/BullMQ,
and much, much more, it is way more exciting to grow ORM in a direction of making it as powerful as possible by further embracing Postgres ecosystem,
than to spend many months on supporting databases with limited functionality.

You can use OrchidORM for the app connected to multiple databases, but it cannot manage table relations spread across databases.

Cannot select relations in create/update/delete returning clause.

Supporting various useful extensions is in plans, but until implemented, you'll need to use raw SQL for this.
OrchidORM is designed the way that you can combine its existing functionality, and add just pieces of custom SQL where it is needed.

Range database types, composite custom types aren't supported.

There are some methods for searching in JSON columns, but just very basic, needs more.
