---
'pqb': patch
'orchid-orm': patch
---

Added `testTransaction.hooks` for test hooks that may time out: their `rollback` and `close` end the test transaction of their own `start`. `testTransaction.start` resolves with the started transaction, and accepts a `signal` to cancel the start (#798).
