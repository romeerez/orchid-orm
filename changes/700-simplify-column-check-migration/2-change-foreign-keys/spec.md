## Summary

Support changing column foreign keys in `changeTable` without repeating the column type, and add zero-argument `t.noForeignKey()` for the side of a change where a foreign key is absent.

```ts
await db.changeTable('table', (t) => ({
  col: t.change(t.foreignKey('a', 'aId'), t.foreignKey('b', 'bId')),
}));
```

```ts
await db.changeTable('table', (t) => ({
  col: t.change(t.noForeignKey(), t.foreignKey('b', 'bId')),
}));
```

`t.noForeignKey()` can be used as either the `from` or `to` argument:

```ts
await db.changeTable('table', (t) => ({
  addFkey: t.change(t.noForeignKey(), t.foreignKey('otherTable', 'foreignId')),
  dropFkey: t.change(t.foreignKey('oldTable', 'oldId'), t.noForeignKey()),
}));
```

The existing longer form remains valid for cases that also change the column type or other column properties:

```ts
await db.changeTable('table', (t) => ({
  col: t.change(
    t.integer().foreignKey('a', 'aId'),
    t.integer().foreignKey('b', 'bId'),
  ),
}));
```

## What Changes

- Extend `rake-db` `changeTable` so `t.change(t.foreignKey(...), t.foreignKey(...))` is valid for changing a single-column foreign key under the object key where it is declared.
- Add zero-argument `t.noForeignKey()` to `changeTable` as a change-only counterpart to `t.foreignKey(...)`, allowing concise add and drop foreign-key changes without repeating the column type.
- Preserve existing typed-column `t.change(t.integer().foreignKey(...), ...)`, table-level `t.foreignKey([...], ...)`, and `t.add`/`t.drop` behavior.
- Update migration code generation so foreign-key-only column changes print the shorter `t.change(t.foreignKey(...), t.foreignKey(...))` or `t.change(t.noForeignKey(), t.foreignKey(...))` syntax when it fully represents the change.
- Update ORM migration generator expectations so generated migrations use the shorter syntax for foreign-key-only single-column diffs and keep full column syntax when other column properties change.

## Assumptions

- The shorter generated form applies only to one foreign key on one local column. Composite foreign keys should continue to use the existing standalone `t.foreignKey([...], ...)` add/drop/change-table constraint representation.
- When adding or dropping a foreign key, generated `t.noForeignKey()` should appear on the empty side and the implementation should infer what to add or drop from the opposite `t.foreignKey(...)` side.
- Mixed `t.change(...)` arguments that combine a typed column on one side and bare `t.foreignKey(...)` or `t.noForeignKey()` on the other are not a new documented API surface.

## Capabilities

This change introduces no standalone capability. It extends the existing `changeTable` column-change DSL and the existing migration code printer for foreign-key-only column changes.

## Detailed Design

### Public API

`rake-db` should accept single-column `t.foreignKey(...)` values as the `from` and `to` arguments of `t.change(...)` when the change belongs to a column property in the `changeTable` object.

```ts
await db.changeTable('table', (t) => ({
  column: t.change(
    t.foreignKey('fromTable', 'fromId', {
      name: 'from_fkey',
      onDelete: 'SET NULL',
    }),
    t.foreignKey('toTable', 'toId', {
      name: 'to_fkey',
      onDelete: 'CASCADE',
    }),
  ),
}));
```

- This shorter `t.foreignKey(...)` form is for column foreign keys only. The object key, or `t.name(...)` when present, supplies the local column name.
- The accepted arguments and options match the existing column `.foreignKey(table, column, options?)` migration form.
- Callback table references are not allowed in migrations, matching the current typed-column migration restriction.
- Rollback reverses the foreign-key change in the same way normal `t.change(...)` reverses `from` and `to`.
- Existing composite/table-level foreign keys remain expressed with `t.foreignKey([columns], table, [foreignColumns], options?)` in table-data positions.

### `noForeignKey`

`t.noForeignKey()` is a marker that represents the absence of a single-column foreign key on that side of a column change.

```ts
await db.changeTable('table', (t) => ({
  column: t.change(
    t.foreignKey('otherTable', 'id', { name: 'table_column_fkey' }),
    t.noForeignKey(),
  ),
}));
```

- `noForeignKey()` is valid only as a `from` or `to` argument of `t.change(...)`.
- When paired with `t.foreignKey(...)`, it adds or removes the represented foreign key while leaving the column type and unrelated column metadata unchanged.
- `noForeignKey()` takes no arguments. The table, foreign column, and options for add/drop behavior are derived from the opposite `t.foreignKey(...)` side so SQL and rollback behavior match the equivalent typed-column migration.
- `noForeignKey()` should not add a table-level constraint, should not be accepted in `t.add`/`t.drop`, and should not become an ORM table definition API.

### Migration Execution

The `rake-db` change-table AST should represent bare foreign-key changes as ordinary column changes whose `from` and `to` column-change data contain foreign-key metadata but no column type change. SQL execution must keep using the existing foreign-key drop/add path for column changes.

- Changing a foreign key with the shorter syntax must produce the same SQL as the equivalent typed-column syntax.
- Adding a foreign key with `t.change(t.noForeignKey(), t.foreignKey(...))` must add only the foreign-key constraint.
- Dropping a foreign key with `t.change(t.foreignKey(...), t.noForeignKey())` must drop only the foreign-key constraint.
- The feature must not alter how column type, default, nullability, comment, collation, compression, primary key, index, exclude, or check changes are detected and executed.
- Existing `t.add(t.integer().foreignKey(...))`, `t.drop(t.integer().foreignKey(...))`, and composite foreign-key semantics must not regress.

### Migration Code Generation

When an AST column change has no type change and the only meaningful difference between `from` and `to` is the column foreign-key list, generated migration code should print each side with `t.foreignKey(...)` or `t.noForeignKey()`.

```ts
column: t.change(
  t.foreignKey('oldTable', 'oldId', { name: 'old_fkey' }),
  t.foreignKey('newTable', 'newId', { name: 'new_fkey' }),
),
```

```ts
column: t.change(
  t.noForeignKey(),
  t.foreignKey('otherTable', 'id', { name: 'table_column_fkey' }),
),
```

- If both sides contain one foreign key, generate `t.foreignKey(...)` for both sides.
- If one side contains one foreign key and the other side contains none, generate `t.noForeignKey()` for the empty side and infer add/drop target metadata from the non-empty side.
- If either side has multiple foreign keys, or the change includes any other column metadata, code generation must keep the existing typed-column output so the migration remains complete and readable.
- Foreign table names, schema qualification, constraint names, `match`, `onUpdate`, and `onDelete` formatting should follow the existing column foreign-key code-generation conventions.

### Documentation

The migration writing docs should show the short foreign-key-only change forms near the existing `changeTable` foreign-key examples. The docs should make clear that `t.noForeignKey()` is a no-argument marker for the side of a column change where a foreign key is absent, and that composite foreign keys continue to use the existing table-level `t.foreignKey([...], ...)` syntax.
