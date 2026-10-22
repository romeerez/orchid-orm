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

The outermost test transaction of an instance routes the tested code through a
`TestTransactionAdapter`: it replaces the transaction adapter of its state, so
that `withOptions` copies keep it, and the bound adapter methods, so that other
instances sharing the adapter reach it; a transaction of another instance gets
it as the adapter of its new state, and existing states keep theirs. Tell the
new state by comparing it with the state before the call: with wrappers of
nested instances, an existing state also holds the adapter passed to the
callback. The wrapper rejects queries, transactions, and savepoints once the
rollback of its test transaction is called. The levels' own starts, rollbacks,
and cleanup must bypass it: nested levels start through
`db.transaction`, and the wrapper recognizes their callbacks. A test transaction
of another instance sharing the adapter is a transaction of the tested code for
it: bypassed, it would start inside a root whose rollback is called, and end
after that root restored the adapter, binding the adapter back to the wrapper.

The root test transaction is the outermost one on the connection. It keeps the
adapter methods it replaced and the wrappers of other instances started inside
it, the innermost last. A wrapper of another instance routes the adapter to
itself when it starts; when it ends, the adapter goes to the innermost wrapper
left, or to the root. Only the root restores the replaced methods; a wrapper
ending after the root leaves the adapter alone, even when a new root has
started. Never restore what a wrapper found at its start: test transactions of
different instances end in any order, and the adapter would stay bound to a
rolled back wrapper, rejecting every following test transaction.

Check for the rollback again right before the callback of a transaction runs:
its savepoint may already exist when the rollback is called, and a start of
another instance would then attach its wrapper after the root.

Exercise these orders with test transactions of separate instances:

- Start test transactions of two other instances inside the root, roll back the
  root first, then start a new one.
- End a test transaction of another instance after a new root started: queries
  of an instance without a test transaction must reach the new root.
- Roll back the middle one of three while the innermost is open: queries of an
  instance without a test transaction must reject rather than reach the root.
- Delay the callback of a start of another instance until the root is rolled
  back: the start must reject, and queries of an instance without a test
  transaction must not reach its wrapper.

A rollback with open or starting inner test transactions (a cascade) blocks the
shared adapter for good: the late code of the test that lost its test
transaction may reach any test transaction on that adapter. Decide the block
synchronously when `rollback()` is called, not in its turn of the queue, and
keep the first error in the state shared by the instances of the adapter.

The block cancels every start whose transaction hasn't started, including one
whose `BEGIN` or `SAVEPOINT` is in flight: a start leaves that set only once its
transaction has started or its start has failed. It binds the methods of the
shared adapter to a rejecting target at once, also when no wrapper routes them.
Wrappers check the block as well, since `withOptions` scopes keep them.

Never unblock: `detach` on a blocked adapter rebinds nothing, and `close` keeps
the block. A start on a blocked adapter is recorded on the stack and cancelled,
so that the paired `rollback` discards it rather than rolling back an outer test
transaction.

Exercise the block with a cascade of another instance after the root was rolled
back: queries of an instance without a test transaction must reject, and so must
a root start paused in its turn before its transaction begins. Exercise an inner
start whose `SAVEPOINT` is in flight at the rollback, a start waiting in the
queue, which rejects at once, and a `withOptions` scope that outlives the
block.

A level's rollback first waits for the queries and savepoints in flight through
the wrapper, including a `hackySavepoint` until it is released or rolled back,
since SQL they send later (the restore of the SQL session context, `RELEASE`)
would run after the rollback, on the outer level or on the reused connection of
the next test transaction. Every `hackySavepoint` must be released or rolled
back, also when a later query of its batch fails, or that rollback never ends.
Never wait for callbacks of transactions of the tested code: the code of a
timed-out test may never end them.

Exercise the wait under all three adapters with a `withOptions({ setConfig })`
query in flight at the rollback of a test transaction on a pool of one
connection, and with a `hackySavepoint` held over the rollback. Exercise the
rejection with a `withOptions` scope and a transaction of another instance
sharing the adapter that outlive their test transaction, and with a test
transaction of another instance started while the rollback waits for a query.
Exercise the chain with a nested test transaction of the outer instance inside a
test transaction of another one, then query the outer instance after both end.

Do not decide on restoring the adapter or closing the connection by what is left
on the stack: a record leaves the stack when `rollback` is called and joins it
when `start` is called, while the transaction ends or begins only in its turn of
the queue. The outermost test transaction of an instance restores the
transaction adapter of its state and ends its routing of the shared adapter when
it ends, and the pool is closed only when no started test transaction is left
open, whether or not it is still on the stack. Otherwise a `start` called during
a rollback begins on the released connection of the rolled back transaction, or
closing the pool waits for a rollback queued behind it. Exercise both with a
rollback that is not awaited before the next `start` or `close`.

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

The `teardownTimeout` of `testTransaction.hooks` is one budget from the call of
`rollback` or `close` through the wait for `start` and `setup`, the rollback,
and closing the pool, not a limit per step. When it runs out, block the adapter
and reject, and let the teardown go on, ignoring its late outcome; never unblock
when it ends. Take the timer from `node:timers`: fake timers of test runners
replace the global `setTimeout`, and a faked timer fires only when the test
advances the time. Exercise it with a query, a `setup`, a `BEGIN`, and closing
the pool held past the limit, with steps that each fit in the limit but not
together, with a late failure of the teardown, which the test runner reports
when it is left unhandled, and with fake timers enabled before the call. Hold
the work past the limit on controlled promises or a `pg_sleep` query rather than
racing a real teardown against a short limit.

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
test transaction's settings.
