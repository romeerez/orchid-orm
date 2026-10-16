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
