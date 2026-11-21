---
'pqb': patch
---

Preserve the original query error when a nested transaction with a `role` fails, and prevent role cleanup from causing an outer rollback under postgres.js (#931)
