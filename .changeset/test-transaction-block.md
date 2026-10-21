---
'pqb': patch
'orchid-orm': patch
---

Block the database adapter after a test transaction is rolled back together with open inner ones, so that the following tests that use it fail instead of running without isolation (#798).
