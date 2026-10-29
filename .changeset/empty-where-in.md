---
'pqb': patch
'orchid-orm': patch
---

Fix an empty list in `whereNotIn`, `orWhereIn`, `orWhereNotIn`, or `whereIn` with `orWhere` matching no records, which made `orCreate` and `upsert` insert duplicates (#842). Fix `create` and other insert methods after an empty `whereIn` inserting nothing (#841)
