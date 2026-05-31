---
'rake-db': minor
'orchid-orm': minor
---

Support standalone change helpers in migrations, so constraints and indexes can be added, dropped, or changed with concise forms like `t.add(t.foreignKey(...))` and `t.drop(t.index(...))`. The old `t.noForeignKey()` helper was removed. (#705)
