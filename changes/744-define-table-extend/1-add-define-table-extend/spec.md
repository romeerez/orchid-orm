## Summary

Add inheritable defaults to the function-style ORM table factory and expose `defineTable.extend` for deriving a table-definition helper with overridden factory options. This lets applications share column configuration while applying ORM-specific defaults, such as a tenant schema, without repeating options on every table.

```ts
const { defineTable: defineBaseTable } = createTableFactory({
  columnTypes: makeAppColumnTypes,
  noPrimaryKey: true,
});

const defineTable = defineBaseTable.extend({
  schema: () => getActiveTenant().schema,
  noPrimaryKey: false,
});

export const BlogPostTable = defineTable('blogPost', (t) => ({
  id: t.identity().primaryKey(),
}));

// Per-table options still take precedence over inherited factory defaults.
export const ConfigTable = defineTable(
  'config',
  { noPrimaryKey: true, generatorIgnore: false },
  (t) => ({ key: t.text() }),
);
```

## What Changes

- Rename the options shared by function-style and legacy table factories to `CommonTableFactoryOptions`.
- Extend the function-style `TableFactoryOptions` with default `schema`, `noPrimaryKey`, and `generatorIgnore` table settings.
- Add `defineTable.extend(options)` to derive a `defineTable` helper whose factory options override its parent’s options.
- Document factory-level table defaults and derived table helpers.

## Assumptions

- `generatorIgnore: false` is accepted for both factory and per-table options so a table can explicitly opt back into migration generation when an inherited factory default is `true`.

## Capabilities

This idea extends the existing table-factory surface and adds no standalone capability.

## Detailed Design

### Factory Option Types

`table.common.ts` exports `CommonTableFactoryOptions<SchemaConfig, ColumnTypes>` containing only the existing options that are also valid for legacy `createBaseTable`. The legacy factory continues to accept this common type unchanged.

`table.ts` declares `TableFactoryOptions<SchemaConfig, ColumnTypes>` as the function-style factory’s public options type, extending the common type with:

```ts
interface TableFactoryOptions<
  SchemaConfig,
  ColumnTypes,
> extends CommonTableFactoryOptions<SchemaConfig, ColumnTypes> {
  schema?: QuerySchema;
  noPrimaryKey?: boolean;
  generatorIgnore?: boolean;
}
```

- `createTableFactory` accepts the function-style `TableFactoryOptions`.
- `schema`, `noPrimaryKey`, and `generatorIgnore` establish defaults for every table created by that factory; they do not apply to legacy class-based tables or views.
- The existing per-table option type permits `generatorIgnore: false` in addition to `true` so it can override an inherited default. Migration behavior remains unchanged: only a truthy value excludes a table from generated DDL reconciliation.

### Factory Defaults and Table Overrides

When `defineTable` creates a table, it resolves the new factory defaults independently:

- A per-table `schema`, `noPrimaryKey`, or `generatorIgnore` value takes precedence when it is explicitly provided, including `false` for the boolean options.
- Otherwise the table uses the corresponding `createTableFactory` or derived-helper default.
- If neither layer provides a value, the existing behavior is preserved.

These resolved values are reflected in the table definition and its ORM/migration metadata exactly as if they had been provided in that table’s own options object.

### `defineTable.extend`

Every `defineTable` returned by `createTableFactory` or by another `extend` call exposes:

```ts
extend<ExtendedSchemaConfig extends ColumnSchemaConfig, ExtendedColumnTypes>(
  options: TableFactoryOptions<ExtendedSchemaConfig, ExtendedColumnTypes>,
): OrmTable.DefineTable<ExtendedSchemaConfig, ExtendedColumnTypes>;
```

- `extend` returns a new `defineTable` helper and leaves its parent helper unchanged.
- The derived helper inherits every parent `TableFactoryOptions` value; each provided extension value replaces the corresponding inherited value. Calls may be chained, with later extensions taking precedence.
- The derived helper retains the normal `defineTable` call overloads, metadata, and `getFilePath` behavior, while exposing `extend` again for further derivation.
- Options that affect column typing or construction, including `schemaConfig` and `columnTypes`, produce a derived helper with the corresponding table column and schema types. Options not overridden retain the parent helper’s types and runtime behavior.
- Extension defaults are used by tables created through the derived helper only. They do not alter tables already defined through the parent or affect the factory’s `defineView` and `sql` helpers.

### Documentation

Document the three function-style factory defaults in the table-factory guide, including a tenant-schema example using `defineTable.extend`. Clarify that per-table options override those defaults and that extending `defineTable` does not modify the original helper.
