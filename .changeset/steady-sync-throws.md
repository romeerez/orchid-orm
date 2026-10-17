---
'pqb': patch
---

Fix `isInTransaction` returning `true` outside of a user transaction, and nested transactions skipping a repeated `role` or `setConfig`, after a transaction callback throws synchronously, which also happens when `testTransaction.rollback` cancels a starting `testTransaction.start` (#798)
