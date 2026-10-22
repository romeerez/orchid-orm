# Query Execution Guidance

## Catching savepoints

A caught query (`catch` or `recoverable`) inside a transaction runs in a
savepoint so that its failure doesn't abort the transaction. A batch, and a
mutation with a selected relation together with the query loading it, hold the
savepoint open over several queries, and the last one releases it. A failure of
any of these queries, or of the code between them such as an after hook, must
roll the savepoint back. Otherwise, a failed query leaves the transaction
aborted, and the driver's `hackySavepoint` promise never settles. Roll back
rather than release after a failure of that code as well: it may have aborted
the transaction with a query of its own, and `RELEASE` would then fail.

Name catching savepoints with `generateSavepointName`, never by a counter in the
async state; see `src/adapters/AGENTS.md`.

Exercise a batch by lowering `MAX_BINDING_PARAMS`, mocked in `then.test.ts`, and
failing either its first or a later query with a value out of the column type's
range: the next query of the transaction must succeed. Exercise a mutation with
a selected relation by rolling back a test transaction started in the test after
it: the rollback waits for the savepoint.
