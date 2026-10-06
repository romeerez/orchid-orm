---
'rake-db': patch
'orchid-orm': patch
---

Fix migration generator trying to drop the bootstrap superuser when it isn't named `postgres` (#766)
