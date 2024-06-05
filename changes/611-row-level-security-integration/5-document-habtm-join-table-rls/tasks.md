## 1. docs

- [x] 1.1 Document join-table RLS guidance for hasAndBelongsToMany
  - 1.1.1 Update the user-facing row-level-security guide to explain that `hasAndBelongsToMany` uses an implicit join table declaration, and users who need RLS on that join table should define it as a regular table class and model the relation with `hasMany` `through` instead.
