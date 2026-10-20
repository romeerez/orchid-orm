---
'pqb': patch
'orchid-orm': patch
---

Give savepoints unique names, so that a test transaction rolls back to its own savepoint when a transaction of another instance sharing the adapter is still open inside it (#798).
