---
'pqb': patch
'orchid-orm': patch
---

Block the database adapter when a test transaction is rolled back while a transaction started inside it is still open (#798)
