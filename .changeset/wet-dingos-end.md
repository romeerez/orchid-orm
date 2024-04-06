---
'pqb': patch
---

Fix json sub-queries for tables with a default scope

Specifically, this fixes selecting relation data from a table that has `softDelete` enabled.
