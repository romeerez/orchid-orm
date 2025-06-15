---
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

Add standalone $afterCommit (#354)

`afterCommit` hooks used to be awaited when awaiting a transaction or a query,
now they become detached, won't be awaited by the main flow.
Make sure to handle their errors inside the hooks or by using `catchAfterCommitError`,
without error handling the hooks will cause unhandled exception errors.

`catchAfterCommitError` can be added multiple times now.
