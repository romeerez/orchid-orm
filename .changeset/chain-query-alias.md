---
'pqb': patch
'orchid-orm': patch
---

Fix `chain` conditions referring to the relation name instead of the table alias of the query, which made the query fail with `as` or when the chain repeats a relation (#864)
