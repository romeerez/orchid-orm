---
'rake-db': patch
'pqb': patch
---

Update transactions nested calls to restore parent transaction search_path; Do a nested transaction call in rake-db `migrate` always, even if already in transaction (#654)
