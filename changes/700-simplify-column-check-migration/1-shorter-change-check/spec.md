## Summary

Support changing column check constraints in `changeTable` without repeating the column type, and have ORM migration generation emit that shorter form when only column checks change.

```ts
await db.changeTable('table', (t) => ({
  age: t.change(
    t.check(t.sql`age > 0`, 'table_age_check'),
    t.check(t.sql`age >= 18`, 'table_age_check'),
  ),
}));
```

The existing longer form remains valid for cases that also change the column type or other column properties:

```ts
await db.changeTable('table', (t) => ({
  age: t.change(
    t.integer().check(t.sql`age > 0`, 'table_age_check'),
    t.integer().check(t.sql`age >= 18`, 'table_age_check'),
  ),
}));
```

## What Changes

- Extend `rake-db` `changeTable` so `t.change(t.check(...), t.check(...))` is valid for changing a column check constraint under the object key where it is declared.
- Preserve current `t.add(t.check(...))` and `t.drop(t.check(...))` behavior for table checks and keep typed-column `t.change(t.integer().check(...), ...)` working.
- Update migration code generation so check-only column changes print the shorter `t.change(t.check(...), t.check(...))` syntax instead of repeating the unchanged column type.
- Update ORM migration generator expectations so generated migrations use the shorter syntax for check-only column diffs and still use full column syntax when other column properties change.

## Assumptions

- The shorter generated form applies only when each side of the change has exactly one check and no other changed column metadata; multi-check changes should keep the existing full-column output unless the implementation adds an equally clear public representation.
- Mixed `t.change(...)` arguments that combine a typed column on one side and bare `t.check(...)` on the other are not a new documented API surface.

## Capabilities

This change introduces no standalone capability. It extends the existing `changeTable` column-change DSL and the existing migration code printer for check-only column changes.

## Detailed Design

### Public API

`rake-db` should accept `t.check(...)` values as the `from` and `to` arguments of `t.change(...)` when the change belongs to a column property in the `changeTable` object.

```ts
await db.changeTable('table', (t) => ({
  column: t.change(t.check(t.sql`column > 0`), t.check(t.sql`column > 10`)),
}));
```

- The public behavior is the same as changing from a column whose only relevant changed metadata is the old check to a column whose only relevant changed metadata is the new check.
- The object key, or `t.name(...)` when present, supplies the affected column name for generated SQL and constraint naming.
- Named checks must preserve their supplied constraint names in both directions.
- Rollback reverses the check change in the same way normal `t.change(...)` reverses `from` and `to`.
- `t.change(t.check(...), t.check(...))` is intended for column check changes. Table-level check add/drop remains expressed with spread `...t.add(t.check(...))` and `...t.drop(t.check(...))`.
- Mixed forms such as `t.change(t.integer().check(...), t.check(...))` should not become a new advertised API; migration generation should either emit both sides as checks for check-only diffs or keep the existing full column syntax when other column metadata is involved.

### Migration Execution

The `rake-db` change-table AST should represent check-only changes as ordinary column changes whose `from` and `to` column-change data contain check metadata but no column type change. SQL execution must keep using the existing check drop/add path for column changes.

- Changing a check with the shorter syntax must produce the same SQL as the equivalent typed-column syntax.
- The feature must not alter how column type, default, nullability, comment, collation, compression, primary key, index, exclude, or foreign key changes are detected and executed.
- Existing `t.add(t.check(...))` and `t.drop(t.check(...))` table-check semantics must not regress.

### Migration Code Generation

When an AST column change has no type change and the only meaningful difference between `from` and `to` is the column check list, generated migration code should print each side as `t.check(...)`.

```ts
column: t.change(
  t.check(t.sql`old expression`, 'constraint_name'),
  t.check(t.sql`new expression`, 'constraint_name'),
),
```

- In the current public shape, the shorter generated form is required only for one old check changing to one new check. If either side has multiple checks, generated code should preserve the existing full-column output unless the implementation adds a clear bare-check representation for multiple checks.
- If the change includes any other column metadata, code generation must keep the existing typed-column output so the migration remains complete and readable.
- Raw SQL formatting and constraint-name formatting should follow the existing `toCode` and `constraintInnerToCode` conventions.

### Documentation

The migration writing docs should show the short check-change form in the `changeTable` `change` examples and make clear that it is for changing a column check constraint without changing the column type.
