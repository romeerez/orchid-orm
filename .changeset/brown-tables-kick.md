---
'pqb': patch
---

Change `get query()` to `getQuery` in error classes to prevent endless recursion when Vitest tries to print an error (#669)
