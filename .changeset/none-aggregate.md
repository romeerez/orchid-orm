---
'pqb': patch
'orchid-orm': patch
---

Fix aggregates of a `none` query: return `0` for `count` and `null` for other aggregates instead of throwing `NotFoundError` (#827)
