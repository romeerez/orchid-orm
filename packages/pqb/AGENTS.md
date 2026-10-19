# PQB Package Guidance

## Query return-mode boundaries

Terminal scalar and pluck methods must discard inherited `batchParsers` before
building their scalar selection. This prevents parsers from a prior nested
relation selection from treating the terminal result as a relation result.

Deduplicated relation-value selections resolve their logical aliases through
`valuesJoinedAs`; their scalar parser is under `joinedParsers[alias].v`.
String-selection parser setup must resolve this centrally so terminal scalar
methods and chained `.select()` calls preserve native result types.

Regression coverage belongs in the corresponding focused query tests and
should exercise a query with a taken relation selected before `pluck`, `get`,
or `getOptional`.

## Column type narrowing

`narrowType` is the supported API for narrowing a column's compatible
input, output, and query TypeScript types together. It does not configure a
PostgreSQL custom type; that separate concern belongs to `t.type(name)`.

## Test transactions

`start`, `rollback`, and `close` of one instance must run one at a time in the
call order, each finishing its cleanup before the next one starts; only the
cancellation of a start that has not started yet takes effect at once: a start
still waiting for its turn rejects at once and is skipped in its turn, and one
whose `BEGIN` or `SAVEPOINT` is in flight is rolled back. A rollback may wait
behind a slow query of a timed-out test while the next hook already calls
`start`; out of order, that `start` reads a transaction state that the rollback
overwrites later. Exercise this with a rollback held behind a `pg_sleep` query
while the next `start` is called, and check that cancelling that `start` rejects
it before the query ends.

`testTransaction.rollback(db)` pairs with the latest `start` call, including one
that failed or is still starting, because test runners run `afterEach` and
`afterAll` after a failed or timed-out `beforeEach` or `beforeAll`. A failed
`start` keeps its record for that `rollback` to discard; otherwise that
`rollback` reaches the outer test transaction. A starting one is cancelled when
`rollback` is called rather than in its turn of the queue, so that its `start`
rejects without leaving a test transaction open and the hook awaiting it stops;
the `rollback` settles once that `start` does. An aborted `signal` of `start`
cancels it the same way.

Exercise this with a failed `start` inside an aborted test transaction: after
the paired `rollback`, the aborted transaction must still be open. To cancel a
start while its `BEGIN` or `SAVEPOINT` is in flight, call `rollback` or abort
from a spy on `adapter.transaction` or
`TransactionAdapterClass.prototype.savepoint`: right after `start`, the
cancellation happens before any SQL.

When called, a handle's `rollback` claims the test transactions whose `start`
was called after its own, rather than those left when its turn in the queue
comes, so a `start` called later is never rolled back with it. Open ones among
them are rolled back as well and reported with `TestTransactionError`; failed
starts are dropped silently.

Do not decide on restoring the adapter or closing the connection by what is left
on the stack: a record leaves the stack when `rollback` is called and joins it
when `start` is called, while the transaction ends or begins only in its turn of
the queue. The test transaction that rebound the adapter restores it, and the
pool is closed only when no started test transaction is left open, whether or
not it is still on the stack. Otherwise a `start` called during a rollback
begins on the released connection of the rolled back transaction, or closing the
pool waits for a rollback queued behind it. Exercise both with a rollback that
is not awaited before the next `start` or `close`.

`testTransaction.hooks` wait for their `start` and `setup` before rolling back,
because a timed-out hook keeps running and its `setup` would write past the
rollback. Once both have ended, `rollback` and `close` reach the test
transaction in the same call, so a `start` called right after is not rolled back
with it, and `close` uses the `close` of the test transaction so that nothing
runs between the rollback and closing the pool. After a failed `start` there is
no test transaction: close by the count of open test transactions, never with
`testTransaction.close(db)`, which takes the record of another start off the
stack. A second `start` before the teardown of the previous one rejects rather
than replacing it, since the replaced test transaction would stay open without
an error. Keep a `start` cancelled by its teardown rejecting, even though Bun
reports the late rejection as an error between tests: code after
`await start()` in a timed-out hook must stop rather than write outside the test
transaction. Exercise the wait with a `setup` held on a controlled promise while
`rollback` is called.

Queries of test bodies carry no async context and cannot be attributed to a test
transaction: do not reject a query by the test transaction it came from.

Code outside of `withOptions` scopes and transaction callbacks, such as a test
body, runs in the innermost test transaction through the storage fallback.
`withOptions` scopes take precedence over the fallback, and a test transaction
started inside a scope keeps that scope's state as the fallback until it is
rolled back.

Exercise the fallback with `withOptions({ setConfig })` inside a test
transaction started on the same instance, and with a test transaction started
inside a `withOptions` scope: after its rollback, queries must see the outer
test transaction's settings. Run it under node-postgres as well: postgres.js
makes savepoint names unique, so only other drivers show a rollback to the
wrong savepoint.
