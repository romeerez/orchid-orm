---
'pqb': patch
'orchid-orm': patch
---

Add the `teardownTimeout` option to `testTransaction.hooks`: a rollback or a close that doesn't end in time rejects and blocks the database adapter, so that the test run fails instead of waiting behind a stuck teardown (#798).
