---
'pqb': patch
---

Reject a transaction that was not committed: under postgres.js when `COMMIT` fails, such as on a deferred constraint, and under every driver when the callback handled the error of a query that failed outside of a savepoint (#931)
