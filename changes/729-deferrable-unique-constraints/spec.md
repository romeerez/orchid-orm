## Summary

Support Postgres deferrable unique constraints through Orchid's existing index and unique declaration surfaces, without accepting `deferrable: true`.

```ts
class ListItemTable extends BaseTable {
  readonly table = 'listItem';

  columns = this.setColumns(
    (t) => ({
      id: t.identity().primaryKey(),
      listId: t.integer(),
      position: t.integer(),
      slug: t.text().unique({
        name: 'list_item_slug_key',
        deferrable: 'immediate',
      }),
    }),
    (t) => [
      t.unique(['listId', 'position'], {
        name: 'list_item_position_key',
        deferrable: 'deferred',
      }),
      t.index(['slug'], {
        unique: true,
        deferrable: 'immediate',
      }),
    ],
  );
}
```

`deferrable: 'deferred'` generates `DEFERRABLE INITIALLY DEFERRED`, `deferrable: 'immediate'` generates `DEFERRABLE INITIALLY IMMEDIATE`, and `deferrable: false` keeps current non-deferrable unique index behavior.

## What Changes

- Add `deferrable?: false | 'immediate' | 'deferred'` to unique index option metadata.
- Make `index` option argument types a union where `deferrable` is only available in the `unique: true` branch.
- Keep `unique` method option argument types non-union, with optional `deferrable`.
- Support deferrable unique definitions wherever users can currently define indexes or unique indexes: column `.unique`, table `t.unique`, column `.index({ unique: true })`, table `t.index(..., { unique: true })`, and migration `changeTable` add/drop/change forms.
- Generate Postgres unique constraint SQL for deferrable unique definitions and preserve deferrability in migration generation comparisons.

## Assumptions

- Deferrable unique definitions continue to be stored with existing index options rather than introducing a separate public unique-constraint collection.
- `deferrable: false` is semantically equivalent to omitting `deferrable`; it is accepted for explicitness but should not change generated SQL or migration diffs.
- A unique definition with `deferrable: 'immediate' | 'deferred'` names a Postgres unique constraint even though it is represented in Orchid's existing index metadata.

## Capabilities

- `deferrable-unique-options`: Extends existing index and unique option metadata and type contracts with explicit Postgres deferrability modes.
- `deferrable-unique-sql`: Emits create, drop, and change SQL for deferrable unique definitions as unique constraints.
- `deferrable-unique-generation`: Preserves and compares unique deferrability when generating migrations from database/code differences.

## Detailed Design

### Public API

The public deferrability value is a strict union with no boolean `true`.

```ts
type UniqueDeferrable = false | 'immediate' | 'deferred';
```

`unique` methods accept the option directly without changing their option argument into a discriminated union.

```ts
interface BaseUniqueOptionsArg<Name extends string = string> {
  name?: Name;
  nullsNotDistinct?: boolean;
  using?: string;
  include?: MaybeArray<string>;
  with?: string;
  tablespace?: string;
  where?: string;
  dropMode?: DropMode;
}

interface UniqueOptionsArg<
  Name extends string = string,
> extends BaseUniqueOptionsArg<Name> {
  deferrable?: UniqueDeferrable;
}
```

`index` methods use a union so `deferrable` is only available when `unique: true` is also present.

```ts
interface NonUniqueIndexOptionsArg extends BaseUniqueOptionsArg {
  unique?: false;
  deferrable?: never;
}

interface UniqueIndexOptionsArg extends UniqueOptionsArg {
  unique: true;
}

type IndexOptionsArg = NonUniqueIndexOptionsArg | UniqueIndexOptionsArg;
```

- `t.index(['a'], { deferrable: 'deferred' })` is rejected by TypeScript because `unique: true` is missing.
- `t.index(['a'], { unique: false, deferrable: 'deferred' })` is rejected by TypeScript.
- `t.index(['a'], { unique: true, deferrable: 'deferred' })` is accepted.
- `t.unique(['a'], { deferrable: 'deferred' })` and `t.text().unique({ deferrable: 'deferred' })` are accepted.
- `deferrable: true` is rejected everywhere.

### Shared State or Data Shape

Deferrability is stored on the existing index option object.

```ts
interface IndexOptions {
  unique?: boolean;
  deferrable?: false | 'immediate' | 'deferred';
}
```

- Column-level and table-level declarations normalize to the same `TableData.Index.options.deferrable` field.
- Existing unique metadata used for `findBy`, `onConflict`, and unique error helpers remains driven by the same unique declarations and column lists.
- `deferrable: false` may be normalized away internally, but introspected or code-defined `'immediate'` and `'deferred'` values must be preserved.

### Migration SQL

A unique definition with `deferrable: 'immediate' | 'deferred'` is emitted as a Postgres unique constraint.

```sql
ALTER TABLE "listItem"
  ADD CONSTRAINT "list_item_position_key"
  UNIQUE ("listId", "position")
  DEFERRABLE INITIALLY DEFERRED;
```

- `'immediate'` maps to `DEFERRABLE INITIALLY IMMEDIATE`.
- `'deferred'` maps to `DEFERRABLE INITIALLY DEFERRED`.
- `false`, omitted, or `undefined` keeps existing non-deferrable unique index SQL.
- Dropping a deferrable unique definition drops the constraint, not an index.
- Changing between omitted/`false`, `'immediate'`, and `'deferred'` is a meaningful schema change and may be represented as drop-and-add.
- `nullsNotDistinct` remains compatible with deferrable unique definitions.
- Constraint names remain important because users may call `SET CONSTRAINTS <name> DEFERRED` or `SET CONSTRAINTS <name> IMMEDIATE`.

### Migration Generation

Migration generation compares deferrability as part of unique index/constraint metadata.

- A deferrable unique constraint present in code and missing from the database is added.
- A deferrable unique constraint present in the database and missing from code is dropped.
- A difference between non-deferrable, initially immediate, and initially deferred unique definitions is detected and generated as a change.
- Matching database and code deferrability produces no migration.
- Generated migration code should use the existing `t.unique` or `t.index(..., { unique: true })` surfaces with the `deferrable` option, preserving names and compatible options.

### Error Handling and Limits

- Orchid must not generate invalid Postgres SQL for deferrable unique definitions.
- `where` with deferrability cannot be implemented as a Postgres partial unique constraint; when this combination reaches SQL generation, it should fail clearly rather than silently emitting invalid SQL.
- Expression-based unique definitions and index-only column options such as `collate`, `opclass`, and `order` are index features, not portable deferrable unique constraint features; when they are combined with active deferrability and cannot be represented by Postgres unique constraint SQL, SQL generation should fail clearly.
- This change does not add a transaction helper for `SET CONSTRAINTS`.

### Documentation

Docs should present the ordered-list use case with composite uniqueness over concrete columns, such as `(listId, position)`, because Postgres cannot defer a partial unique index for soft-delete-only uniqueness.
