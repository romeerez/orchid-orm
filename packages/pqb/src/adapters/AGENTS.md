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

## postgres.js versions

The postgres.js adapter supports v3 and v4 with the same code, typed by v4.
Apply a workaround for one version only when its runtime has a feature of that
version, as the v3 array parser patch checks `options.shared.typeArrayMap`, and
map an error property named differently by the versions to an array of names in
`errorFields`.

Leave `infer` unset, to the driver's default.

Keep `query.execute()` in `queryClient`: otherwise postgres.js v4 sends a
`SAVEPOINT` of a nested transaction before the setup queries of its parent.

Run tests with `ADAPTER=postgres-js-v3` to exercise v3.

The `postgres` peer dependency of `pqb` lists only the supported majors, and
`create-orm` installs the latest of them. Update both when supporting a new
major.
