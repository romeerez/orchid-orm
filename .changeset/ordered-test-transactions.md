---
'pqb': patch
---

Fixed `isInTransaction()` returning `true` after a test transaction was started while the previous one was still rolling back (#798)
