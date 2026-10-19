---
'pqb': patch
'orchid-orm': patch
---

`testTransaction.start` cancelled by `rollback` or by its `signal` while waiting for the previous test transaction to roll back rejects at once (#798).
