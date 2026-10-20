# Query Execution Guidance

## Catching savepoints

A caught query (`catch` or `recoverable`) inside a transaction runs in a
savepoint so that its failure doesn't abort the transaction. A batch opens the
savepoint with its first query and releases it after the last one. A failure of
any of its queries must roll the savepoint back. Otherwise, the transaction
stays aborted and the driver's `hackySavepoint` promise never settles.

Name catching savepoints with `generateSavepointName`, never by a counter in the
async state; see `src/adapters/AGENTS.md`.

Exercise a batch by lowering `MAX_BINDING_PARAMS`, mocked in `then.test.ts`, and
failing either its first or a later query with a value out of the column type's
range: the next query of the transaction must succeed.
