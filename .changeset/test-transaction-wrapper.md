---
'pqb': patch
'orchid-orm': patch
---

Wait for running queries before rolling back a test transaction, and reject queries of a `$withOptions` callback that outlived the outermost one (#798).
