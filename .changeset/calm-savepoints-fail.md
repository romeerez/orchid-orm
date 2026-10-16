---
'pqb': patch
---

Reject `testTransaction.start` with the database error instead of hanging when its transaction cannot start, for example, when the outer transaction is aborted; `testTransaction.rollback` called while `start` is in progress rolls back that transaction instead of hanging; a failed `SAVEPOINT` rejects with its own error instead of a `ROLLBACK TO` error or hanging (#798)
