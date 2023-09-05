---
'rake-db': patch
---

Do not drop index when dropping a column in `changeTable` because it's done by db (#172)
