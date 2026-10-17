---
'pqb': patch
---

Fix an unhandled rejection, which crashes Node by default, when the callback of a `transaction` with `role` or `setConfig` throws before its first `await`
