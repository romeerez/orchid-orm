---
'orchid-orm': minor
'pqb': minor
---

Fix type of `relId` returned from `create` for a belongsTo relation: it was wrongfully loosing `null` union, now it won't. Also, made `create` input type stricter: now it won't allow extra properties, they were allowed before. (#687)
