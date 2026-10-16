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

`testTransaction.rollback` pairs with the latest `start` call, including one
that failed or is still starting, because test runners run `afterEach` and
`afterAll` after a failed or timed-out `beforeEach` or `beforeAll`. A failed
`start` keeps its record for that `rollback` to discard, and a starting one is
rolled back once it starts, rejecting its `start` so that the hook awaiting it
stops. Otherwise that `rollback` reaches the outer test transaction.

Exercise this with a failed `start` inside an aborted test transaction: after
the paired `rollback`, the aborted transaction must still be open.
