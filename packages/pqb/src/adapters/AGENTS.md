# Adapters Guidance

## Transaction session context tests

After a transaction sets a custom setting, the connection that ran it reports
that setting as `''` rather than `NULL`. Assertions that a setting did not leak
out of a transaction must treat `''` and `NULL` as unset, because the pool may
run the follow-up query on that connection or on a fresh one.

## Savepoints

A failed `SAVEPOINT` leaves no savepoint to roll back to: running
`ROLLBACK TO SAVEPOINT` for it replaces the original error. Callers release or
roll back a hacky savepoint even after its `SAVEPOINT` failed.

To make `SAVEPOINT` fail in a test, abort the transaction with a failed query.

Name savepoints of transactions and of caught queries with
`generateSavepointName`, never by a number kept in the async state. Inside a
test transaction, instances sharing an adapter run on one connection, each with
its own state, so numbers kept per state repeat. `ROLLBACK TO` and `RELEASE`
then go to the latest savepoint with that name: one of another instance, or of a
later test when code of a timed-out test ends late.

Exercise it under node-postgres or Bun: postgres.js prefixes names with its own
counter and never releases savepoints. Assert savepoint SQL with
`expect.stringMatching`, not by a fixed name.
