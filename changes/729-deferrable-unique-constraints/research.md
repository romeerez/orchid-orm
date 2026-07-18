# Deferrable Unique Constraints

## Purpose and goals

Support defining Postgres deferrable unique constraints in Orchid table definitions and migrations.

The motivating use case is ordered records where positions must be unique, but a reorder operation may temporarily create duplicate positions while several rows are updated. A regular unique constraint or unique index rejects the intermediate state even when the transaction would end with valid unique positions.

Deferrable unique constraints let the database keep the real uniqueness invariant while checking it later, either at transaction commit or after `SET CONSTRAINTS ... IMMEDIATE`.

Example of the database behavior:

```sql
CREATE TABLE list_items (
  id integer PRIMARY KEY,
  list_id integer NOT NULL,
  position integer NOT NULL,
  CONSTRAINT list_items_list_position_key
    UNIQUE (list_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

BEGIN;

-- Temporary duplicates are allowed inside the transaction.
UPDATE list_items
SET position = position + 1
WHERE list_id = 1 AND position >= 3;

INSERT INTO list_items (id, list_id, position)
VALUES (123, 1, 3);

-- The final state is checked here.
COMMIT;
```

Without the deferrable constraint, the bulk `UPDATE` can fail as soon as one row is moved into a position that another not-yet-updated row still occupies.

## Valuable external context

Postgres supports three constraint timing modes: `NOT DEFERRABLE`, `DEFERRABLE INITIALLY IMMEDIATE`, and `DEFERRABLE INITIALLY DEFERRED`.

`NOT DEFERRABLE` is the default and is always checked immediately. A `DEFERRABLE INITIALLY IMMEDIATE` constraint is checked immediately by default, but a transaction can run `SET CONSTRAINTS constraint_name DEFERRED`. A `DEFERRABLE INITIALLY DEFERRED` constraint is checked at transaction commit by default, and can be forced earlier with `SET CONSTRAINTS ... IMMEDIATE`.

Postgres `SET CONSTRAINTS` affects only `UNIQUE`, `PRIMARY KEY`, `REFERENCES` / foreign key, and `EXCLUDE` constraints. `NOT NULL` and `CHECK` constraints are always immediate.

Postgres syntax allows `DEFERRABLE` and `INITIALLY DEFERRED` / `INITIALLY IMMEDIATE` on column constraints and table constraints, including unique and composite unique constraints:

```sql
CREATE TABLE example (
  a integer,
  b integer,
  CONSTRAINT example_a_b_key UNIQUE (a, b) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE example
  ADD CONSTRAINT example_a_b_key
  UNIQUE (a, b)
  DEFERRABLE INITIALLY DEFERRED;
```

Postgres creates a unique B-tree index behind a unique constraint, but a unique constraint is not the same user-facing object as a unique index.

Important limitation: Postgres cannot express partial uniqueness, such as `WHERE deleted_at IS NULL`, as a unique constraint. Official docs say a uniqueness restriction covering only some rows must be enforced with a unique partial index. Indexes themselves cannot be deferred, so a partial unique index cannot be `DEFERRABLE`. This means an API shape like `{ where: 'deleted_at is null', deferrable: true }` cannot map directly to valid Postgres `UNIQUE ... WHERE ... DEFERRABLE` SQL.

Rails exposes this as `add_unique_constraint` with `deferrable: false | :immediate | :deferred`; its examples generate `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (...) DEFERRABLE INITIALLY DEFERRED`.

Django exposes `UniqueConstraint(deferrable=Deferrable.DEFERRED | Deferrable.IMMEDIATE)` and documents that deferred unique constraints are enforced at transaction end. Django separately has `UniqueConstraint.condition` for partial unique constraints, but notes conditions follow index-condition restrictions; this mirrors the Postgres distinction between constraints and partial indexes.

Prisma has a long-running feature request for deferrable unique constraints. The pain point is the same ordered-list / shifted-position case: workarounds require carefully ordering many single-row updates, manual SQL, or schema drift outside the migration system.

## Community ideas and pain points

The Orchid issue asks for deferrable unique constraints, including composite unique constraints, with ordered item positions as the motivating case.

The issue's proposed example includes a partial uniqueness predicate:

```ts
t.unique(['position'], { where: 'deleted_at is null', deferrable: true });
```

That example captures a likely real application need, but Postgres does not support deferrable partial unique indexes. Orchid should either reject that combination clearly or offer a separate documented alternative when soft-delete scoped uniqueness is required.

Community examples from Prisma, Rails, and Postgres discussions show the same recurring pain:

- Bulk shifting ordered rows can fail even though the final state would be valid.
- Ordered single-row updates can avoid conflicts in simple cases, but are slower, more complex, and brittle for swaps or arbitrary reorder operations.
- Manual migration SQL can work, but migration generators and schema diff tools may later drop or rewrite the database-specific deferrability unless they understand it.

## Requirements and edge cases

- Support single-column and composite unique constraints.
- Support both `DEFERRABLE INITIALLY IMMEDIATE` and `DEFERRABLE INITIALLY DEFERRED`.
- Keep `NOT DEFERRABLE` / current behavior as the default.
- Make it clear that `deferrable: true` needs a defined meaning if accepted. The most ergonomic interpretation is likely `DEFERRABLE INITIALLY DEFERRED`, but Postgres distinguishes deferrable from initially deferred.
- Do not silently generate invalid SQL for `{ where, deferrable }` on a unique definition. Postgres unique constraints do not support `WHERE`; partial unique indexes do not support deferral.
- `NULLS NOT DISTINCT` can be combined with unique constraints on Postgres 15+, so it should not be treated as incompatible with deferrability.
- Constraint names matter more for deferrable constraints because users may run `SET CONSTRAINTS name DEFERRED` or `SET CONSTRAINTS name IMMEDIATE`.
- `SET CONSTRAINTS` only works inside a transaction for deferrable constraints. For `INITIALLY IMMEDIATE`, users need a transaction-level way to defer the constraint before running the conflicting updates.
- Changing an existing non-deferrable unique constraint into a deferrable one generally requires dropping and recreating the constraint; migration generation should model this as a meaningful schema change.
- A unique index may be attachable as a unique constraint with `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX ... DEFERRABLE`, but partial indexes cannot become unique constraints.
- Deferred checking can move a uniqueness error from the exact mutating statement to commit time, so user-facing docs should explain the debugging tradeoff.
- Deferred unique constraints may have a performance cost compared with immediate unique checks.

## Existing support in orchid-orm

This feature is absent.

Orchid currently exposes unique definitions through `t.unique(...)` and column `.unique(...)`, but the metadata is modeled as indexes:

- `TableData` has `indexes`, `excludes`, and generic `constraints`, but no unique-constraint shape.
- `t.unique(...)` is implemented by creating index metadata with `options.unique = true`.
- Migration SQL generation emits `CREATE UNIQUE INDEX ...` for unique definitions, including column and composite forms.
- Docs consistently describe these as unique indexes, including composite unique indexes.
- Pull/generate round-trips existing unique indexes with options such as `where` and `nullsNotDistinct`.

Related support exists:

- Composite unique definitions are already part of table metadata and are used by query typings for unique lookup methods.
- `NULLS NOT DISTINCT` is supported for unique indexes and should remain compatible where Postgres supports it on unique constraints.
- `EXCLUDE` is already generated as `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE`, so Orchid has precedent for index-backed table constraints that are not modeled as ordinary indexes.
- Generic table constraints currently cover checks and foreign keys. `constraintToSql` emits `CONSTRAINT ...` for those, but not unique constraints.
- Transaction options already include `deferrable`, but that is Postgres `BEGIN ... DEFERRABLE`, not `SET CONSTRAINTS` and not unique-constraint deferral.

Important limitations in current introspection and generation:

- Database introspection reads regular indexes from `pg_index` and constraints from `pg_constraint`.
- Constraint introspection currently includes only primary keys, foreign keys, and checks (`contype IN ('p', 'f', 'c')`), not unique constraints (`contype = 'u'`).
- `DbStructure.Constraint` has no deferrability fields, so `condeferrable` and `condeferred` would currently be lost.
- A deferrable unique constraint in an existing database would likely be pulled as its backing unique index, losing the fact that it is a deferrable constraint.
- Migration generation compares unique definitions as indexes, so it cannot currently detect a change from non-deferrable unique index/constraint to deferrable unique constraint.

Design implication: adding this cleanly requires Orchid to distinguish "unique index" from "unique constraint" at the user-facing metadata level, even if the ergonomic API remains `t.unique(...)`.

## Proposed user-facing design

Keep the common Orchid API small:

```ts
class ListItemTable extends BaseTable {
  readonly table = 'listItem';

  columns = this.setColumns(
    (t) => ({
      id: t.identity().primaryKey(),
      listId: t.integer(),
      position: t.integer(),
    }),
    (t) => [
      t.unique(['listId', 'position'], {
        name: 'list_item_position_key',
        deferrable: 'deferred',
      }),
    ],
  );
}
```

`deferrable: 'deferred'` should mean `DEFERRABLE INITIALLY DEFERRED`.

`deferrable: 'immediate'` should mean `DEFERRABLE INITIALLY IMMEDIATE`, for users who want normal immediate checks by default but still want to opt into `SET CONSTRAINTS ... DEFERRED` inside selected transactions.

If `deferrable: true` is supported, it should be only a convenience alias for `'deferred'`. The docs should still teach the two explicit modes because Postgres distinguishes "can be deferred" from "starts deferred".

Column-level usage should also be possible for the single-column case:

```ts
position: t.integer().unique({
  name: 'list_item_position_key',
  deferrable: 'deferred',
});
```

The generated SQL for a deferrable unique should be a table constraint, not a unique index:

```sql
ALTER TABLE "listItem"
  ADD CONSTRAINT "list_item_position_key"
  UNIQUE ("listId", "position")
  DEFERRABLE INITIALLY DEFERRED;
```

Reject or type-disallow incompatible combinations:

- `where` with `deferrable`, because Postgres partial unique indexes cannot be deferred.
- expression-based unique definitions with `deferrable`, because Postgres unique constraints require named columns.
- index-only options that do not exist on unique constraints, such as `using`, per-column `collate`, `opclass`, or `order`.

Allow compatible unique-constraint options:

- `name`
- `nullsNotDistinct`
- `include`
- `with`
- `tablespace`
- `dropMode`

Docs should explicitly explain the soft-delete case from the issue:

```ts
t.unique(['position'], {
  where: '"deleted_at" IS NULL',
  deferrable: 'deferred',
});
```

should not be presented as supported because Postgres cannot enforce that as a deferrable unique constraint. Users must choose between:

- partial uniqueness for active rows, enforced immediately with a unique partial index; or
- deferrable uniqueness over all rows, enforced by a unique constraint.

For ordered rows, the practical example should use a scope column such as `listId` and avoid `where`, because that is the case Postgres can solve directly.

Migration pull/generate should preserve deferrable unique constraints as constraints, not degrade them to unique indexes. Generated changes should treat deferrability changes as drop-and-add operations unless a safe Postgres form is available for the exact case.

## References

- Orchid issue #729: https://github.com/romeerez/orchid-orm/issues/729
- Postgres `CREATE TABLE`: https://www.postgresql.org/docs/current/sql-createtable.html
- Postgres constraints docs: https://www.postgresql.org/docs/current/ddl-constraints.html
- Postgres `SET CONSTRAINTS`: https://www.postgresql.org/docs/current/sql-set-constraints.html
- Postgres `ALTER TABLE`: https://www.postgresql.org/docs/current/sql-altertable.html
- Rails `add_unique_constraint`: https://edgeapi.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/PostgreSQL/SchemaStatements.html#method-i-add_unique_constraint
- Django `UniqueConstraint.deferrable`: https://docs.djangoproject.com/en/6.0/ref/models/constraints/#uniqueconstraint-deferrable
- Prisma feature request: https://github.com/prisma/prisma/issues/8807
- DBA StackExchange discussion of partial deferrable unique indexes: https://dba.stackexchange.com/questions/166082/deferrable-unique-index-in-postgres
- Hashrocket ordered-list explanation: https://hashrocket.com/blog/posts/deferring-database-constraints
