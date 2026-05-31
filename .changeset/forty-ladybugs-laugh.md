---
'rake-db': patch
'pqb': patch
'orchid-orm': patch
---

Fix savepoint handling for postgres-js: rolled back savepoint used to rollback the transaction, now it won't (#702)
