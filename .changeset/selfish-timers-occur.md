---
'orchid-orm': patch
'pqb': patch
---

Add type-level read-only table support that keeps read queries available while gating mutation APIs and relation actions that would mutate read-only tables (#360)
