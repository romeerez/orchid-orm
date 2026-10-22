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

Keep the testTransaction guide to usage and outcomes; put guarantees and edge
cases in the JSDoc and here.

### Queue and pairing

`start`, `rollback`, and `close` of one instance run one at a time in the call
order, each finishing its cleanup before the next one starts: a rollback may
wait behind a slow query of a timed-out test while the next hook already calls
`start`, and, out of order, that `start` reads a state the rollback overwrites
later. Cancelling a start is decided at the call, not in its turn: a start
waiting for its turn rejects at once, so that a hook awaiting it stops without
leaving a test transaction open.

`testTransaction.rollback(db)` pairs with the latest `start` call, including a
failed or starting one, because test runners run `afterEach` and `afterAll`
after a failed or timed-out `beforeEach` or `beforeAll`; without the record of a
failed `start`, it would roll back the outer test transaction. A handle's
`rollback` claims the starts called after its own when it is called, not when
its turn comes.

Do not decide on restoring the adapter or closing the pool by the stack: records
join and leave it when `start` and `rollback` are called, while transactions
begin and end in their turn of the queue. Otherwise a `start` called during a
rollback begins on the released connection, or closing the pool waits for a
rollback queued behind it.

To cancel a start while its `BEGIN` or `SAVEPOINT` is in flight, cancel from a
spy on `adapter.transaction` or `TransactionAdapterClass.prototype.savepoint`:
right after `start`, no SQL has been sent yet.

### Routing

The `TestTransactionAdapter` of the outermost test transaction of an instance
must route the queries of `withOptions` copies and of other instances sharing
the adapter. The levels' own starts, rollbacks, and cleanup bypass it, but a
test transaction of another instance goes through it as tested code: if it
bypassed the wrapper, it would start inside a root whose rollback is called, and
end after that root restored the adapter, binding the adapter back to the
wrapper.

Only the root, the outermost test transaction on the connection, restores the
adapter methods. Never restore what a wrapper found at its start: a wrapper of
another instance may end after the root, even after a new root has started, and
the adapter would stay bound to a rolled back wrapper, rejecting every following
test transaction. Exercise it by holding the end of such a test transaction
after its database transaction has ended; holding the database transaction
itself makes the rollback of the root block the adapter.

Check for the rollback again right before the callback of a transaction runs:
its savepoint may already exist when the rollback is called, and a start of
another instance would then attach its wrapper after the root.

### Waits before a rollback

A rollback waits for the queries and savepoints in flight through the wrapper,
including a `hackySavepoint` until it is released or rolled back: SQL they send
later (the restore of the SQL session context, `RELEASE`) would run on the outer
level or on the connection of the next test transaction. Every `hackySavepoint`
must be released or rolled back, also when a later query of its batch fails, or
the rollback never ends.

It also waits for runs of after-commit hooks across instances sharing the
adapter, including runs started by those hooks: a test ending right after a
query with such a hook is the normal case. Never wait for callbacks of
transactions of the tested code: a timed-out test may never end them.

Register a run of hooks inside the microtask that calls them, right before
calling them: fake timers replace `queueMicrotask`, and a hook may call the
rollback at once. Failures of hooks not handled by `catchAfterCommitError` must
remain unhandled rejections.

Exercise the waits under all three adapters with a `withOptions({ setConfig })`
query in flight on a pool of one connection. To test the hooks of a query run by
a hook, start that query a turn of the event loop after the first hook ended, or
a single wait lets the rollback go first.

### Blocking

A rollback with open or starting inner test transactions, a transaction still
open after the waits, and a teardown over `teardownTimeout` block the shared
adapter for good: the late code of the test that lost its test transaction may
reach any test transaction on that adapter. A late end of a transaction also
sends `RELEASE` or `ROLLBACK TO` of a savepoint that is gone, which fails and
aborts whatever transaction is open on the connection then.

Decide the block for inner test transactions synchronously when `rollback()` is
called, not in its turn of the queue, and keep the first error. The block
cancels every start whose transaction hasn't started, including one whose
`BEGIN` or `SAVEPOINT` is in flight, and reaches adapters kept by `withOptions`
scopes. Never unblock, whether by `detach` or `close`.

Check for open transactions after the waits, since after-commit hooks run
transactions.

Attribute a transaction to the innermost test transaction on the connection,
whatever its instance: savepoints nest by the time they start. A test
transaction counts transactions from sending its `SAVEPOINT` until its database
transaction ends, not from the call of `start` to the end of the test
transaction: a start rejected by a wrapper sends no SQL, and the test
transaction may end after its savepoint is gone, so either would count
transactions of the level around it.

### `testTransaction.hooks`

Exercise `teardownTimeout` with fake timers enabled before the call, and hold
the work past the limit on controlled promises or a `pg_sleep` query rather than
racing a real teardown against a short limit.

### Async context

Queries of test bodies carry no async context: do not reject a query by the test
transaction it came from. They run in the innermost test transaction through the
storage fallback; `withOptions` scopes take precedence over it, and a test
transaction started inside a scope keeps that scope's state as the fallback
until it is rolled back.
