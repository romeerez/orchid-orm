---
'orchid-orm': patch
---

Fix nested `belongsTo` `delete` and `upsert` failing in a `chain` query or a query with `as`, and ignoring `withSchema` and the scopes of the query (#849)
