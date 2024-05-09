---
'pqb': minor
---

`onConflict` changes:

- `onConflictIgnore` is renamed to `onConflictDoNothing` (was closer to Knex, becomes closer to SQL).
- `onConflict(...).merge` no longer accepts a set for update, only columns for merging.
- New `onConflict(...).set`: use `set` for setting specific values instead of `merge` as it was previously.
- `onConflict(...).merge` now can also accept `{ except: string | string[] }` to merge all values except for specified.
