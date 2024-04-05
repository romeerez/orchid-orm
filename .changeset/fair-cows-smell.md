---
'rake-db': minor
---

Add `afterChangeCommit`, change callbacks signatures.

`beforeMigrate`, `afterMigrate`, `beforeRollback`, `afterRollback` were previously receiving only `db` argument,
now they're receiving an object `{ db, migrations }` where `migrations` is an array of executed migrations.

`beforeChange`, `afterChange` were previously receiving `db, up, redo` arguments,
now they're receiving an object `{ db, up, redo, migrations }`.

`afterChangeCommit` receives object `{ options, up, migrations }` where `options` is for database connection options.
