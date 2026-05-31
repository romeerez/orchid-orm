## Summary

Support standalone rake-db change helpers for column-level constraints and indexes, and use `t.add(...)` / `t.drop(...)` for adding or removing those standalone items instead of `t.noForeignKey()`.

```ts
await db.changeTable('table', (t) => ({
  id: t.add(t.primaryKey()),
  oldId: t.drop(t.primaryKey()),
  ownerId: t.add(t.foreignKey('users', 'id', { name: 'table_owner_id_fkey' })),
  slug: t.add(t.unique({ name: 'table_slug_key' })),
  period: t.change(
    t.exclude('&&', { name: 'old_period_exclude' }),
    t.exclude('&&', { name: 'new_period_exclude' }),
  ),
}));
```

The existing full-column form remains valid when the column type or multiple column properties change together:

```ts
await db.changeTable('table', (t) => ({
  slug: t.change(t.text().index(), t.text().unique()),
}));
```

Table-level helpers remain spread object entries:

```ts
await db.changeTable('table', (t) => ({
  ...t.add(t.primaryKey(['one', 'two'])),
  ...t.drop(t.foreignKey(['one'], 'otherTable', ['id'])),
}));
```

## What Changes

- Extend `rake-db` `changeTable` so `t.change(...)` accepts standalone `t.primaryKey(...)`, `t.index(...)`, `t.unique(...)`, and `t.exclude(...)` values in the same column-keyed style already used by standalone `t.check(...)` and single-column `t.foreignKey(...)`.
- Extend column-keyed `t.add(...)` and `t.drop(...)` to support standalone `t.check(...)`, `t.foreignKey(...)`, `t.primaryKey(...)`, `t.index(...)`, `t.unique(...)`, and `t.exclude(...)`.
- Remove the `t.noForeignKey()` migration helper, its validation paths, its tests, and user-facing documentation because `t.add(t.foreignKey(...))` and `t.drop(t.foreignKey(...))` replace it.
- Preserve table-level spread forms such as `...t.add(t.primaryKey([...]))`, `...t.drop(t.index([...]))`, `...t.add(t.check(...))`, and composite `t.foreignKey([...], ...)`.
- Leave migration code generation unchanged; generated migrations should continue to use the existing output forms.

## Assumptions

- Standalone `t.primaryKey(...)` for a column accepts the same optional constraint name as column `.primaryKey(...)`; the existing array form `t.primaryKey([...], ...)` continues to mean a table-level primary key.
- Standalone `t.index(...)` and `t.unique(...)` under a column key accept the same options as column `.index(...)` and `.unique(...)`; the existing array forms continue to mean table-level indexes.
- Standalone `t.exclude(...)` under a column key accepts the same operator and options as column `.exclude(...)`; the existing array form continues to mean a table-level exclusion constraint.

## Capabilities

This change introduces no standalone capability. It extends the existing `changeTable` migration DSL for column-keyed constraint and index metadata changes.

## Detailed Design

### Public API

`rake-db` should accept standalone column-level helpers in `t.change(...)` when the change belongs to a property inside the `changeTable` object.

```ts
await db.changeTable('table', (t) => ({
  id: t.change(t.primaryKey('old_pkey'), t.primaryKey('new_pkey')),
  email: t.change(
    t.index({ name: 'old_email_idx' }),
    t.unique({ name: 'new_email_key' }),
  ),
  period: t.change(
    t.exclude('&&', { name: 'old_period_exclude' }),
    t.exclude('&&', { name: 'new_period_exclude' }),
  ),
}));
```

- The object key, or `t.name(...)` when present, supplies the affected local column name for SQL generation and default constraint naming.
- `t.unique(...)` is a thin wrapper around the standalone column-index helper and produces the same column index metadata as `t.index(...)` with `unique: true`.
- Standalone single-column `t.foreignKey(table, column, options?)` and standalone `t.check(sql, name?)` remain supported in `t.change(...)`.
- `t.change(...)` with standalone helpers is for changing one present metadata item into another present metadata item. Adding or removing the item should use `t.add(...)` or `t.drop(...)`.
- Mixed standalone-helper changes such as `t.change(t.index(...), t.unique(...))` are valid when they map to the same metadata family. Full-column syntax remains the documented form for changing the column type or unrelated column metadata at the same time.

### Add and Drop Standalone Column Metadata

Column-keyed `t.add(...)` and `t.drop(...)` should accept every standalone helper that can describe a single-column constraint or index.

```ts
await db.changeTable('table', (t) => ({
  id: t.add(t.primaryKey()),
  checked: t.drop(t.check(t.sql`checked > 0`, 'checked_positive')),
  ownerId: t.add(t.foreignKey('users', 'id')),
  search: t.drop(t.index({ name: 'table_search_idx' })),
  slug: t.add(t.unique({ name: 'table_slug_key' })),
  period: t.add(t.exclude('&&', { name: 'table_period_exclude' })),
}));
```

- `col: t.add(t.primaryKey())` adds a primary key involving `col` on migrate and drops it on rollback.
- `col: t.drop(t.primaryKey())` drops the primary key involving `col` on migrate and adds it on rollback.
- The same add/drop reversal rule applies to standalone `check`, `foreignKey`, `index`, `unique`, and `exclude`.
- `t.add(...)` / `t.drop(...)` with a standalone helper should not add or drop the column itself.
- Table-level spread forms continue to behave as table-level changes. For example, `...t.add(t.check(...))` is still a table check, while `col: t.add(t.check(...))` is a column-keyed check change.

### Remove `noForeignKey`

`t.noForeignKey()` should be removed from the migration DSL.

```ts
await db.changeTable('table', (t) => ({
  ownerId: t.add(t.foreignKey('users', 'id')),
  previousOwnerId: t.drop(t.foreignKey('users', 'id')),
}));
```

- Existing `t.change(t.foreignKey(...), t.foreignKey(...))` remains valid for replacing one foreign key with another.
- Adding a foreign key should be expressed as `col: t.add(t.foreignKey(...))`.
- Dropping a foreign key should be expressed as `col: t.drop(t.foreignKey(...))`.
- Runtime branches and tests that only exist to reject or validate `noForeignKey()` should be removed.

### Migration Execution

The runtime should normalize standalone helper add/drop/change inputs into the existing metadata-only column change handling.

- Standalone add/drop/change helpers must produce the same SQL as the equivalent typed-column metadata change when no column type change is involved.
- Rollback must be represented by reversing the same metadata-only column change.
- Primary-key aggregation across multiple columns must keep working for both typed-column primary-key changes and standalone `t.add(t.primaryKey())` / `t.drop(t.primaryKey())`.
- Index, unique, exclude, check, and foreign-key names, options, `dropMode`, `snakeCase`, and `t.name(...)` handling should follow the existing typed-column and table-level conventions.
- Existing typed-column `t.add(t.integer().index())`, `t.drop(t.integer().foreignKey(...))`, and `t.change(t.integer(), t.integer().primaryKey())` behavior must not regress.
- Migration code generation must not be changed as part of this feature.

### Documentation

The migration writing docs should show `t.add(...)`, `t.drop(...)`, and `t.change(...)` with standalone helpers for column-keyed primary keys, checks, foreign keys, indexes, unique indexes, and exclusion constraints. Existing mentions and examples of `t.noForeignKey()` should be removed, and foreign-key add/drop examples should use `t.add(t.foreignKey(...))` and `t.drop(t.foreignKey(...))`.
