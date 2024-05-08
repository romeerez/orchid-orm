---
'orchid-orm-valibot': minor
'orchid-orm-schema-to-zod': minor
'orchid-orm-test-factory': minor
'rake-db': minor
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

- Rework composite indexes, primary and foreign keys.
- Change `findBy` to filter only by unique columns.
- `onConflict` now will require columns for `merge`, and it can also accept a constraint name.

See the BREAKING_CHANGE.md at orchid-orm 1.26 at the repository root for details.
