## Summary

Infer `belongsTo` relations as required by default when every local relation column is non-nullable, while preserving explicit `required` overrides.

```ts
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    authorId: t.integer(),
    reviewerId: t.integer().nullable(),
  }));

  relations = {
    author: this.belongsTo(() => UserTable, {
      columns: ['authorId'],
      references: ['id'],
    }),

    reviewer: this.belongsTo(() => UserTable, {
      columns: ['reviewerId'],
      references: ['id'],
    }),
  };
}

const post = await db.post
  .select('id', {
    author: (q) => q.author,
    reviewer: (q) => q.reviewer,
  })
  .take();

// author is User, reviewer is User | undefined
post.author.id;
post.reviewer?.id;
```

For composite keys, the inferred default is required only when all local `columns` are non-nullable.

```ts
relations = {
  account: this.belongsTo(() => AccountTable, {
    columns: ['tenantId', 'accountId'],
    references: ['tenantId', 'id'],
  }),
};
```

## What Changes

- `belongsTo` infers `required: true` by default when every column listed in its local `columns` option is non-nullable.
- `belongsTo` remains optional by default when any local relation column is nullable.
- Explicit `required: true` and `required: false` continue to override inference.
- Composite-key `belongsTo` relations use all local `columns`; referenced table columns do not affect the default.
- The inferred requiredness must drive the same TypeScript and runtime relation behavior as an explicit `required: true`.
- At runtime, a non-nullable omitted-`required` `belongsTo` must act exactly as if the user wrote `required: true`.
- Relation docs should explain the inferred default and when to use explicit overrides.

## Assumptions

- The inferred default describes the nullability contract of the local foreign-key columns, not a runtime guarantee that a matching related row exists when the database lacks an enforced foreign key or contains inconsistent data.
- Column defaults do not make a relation optional. A non-nullable foreign-key column with a default still infers a required `belongsTo`; only nullable local columns make the default optional.

## Capabilities

- `belongs-to-required-inference`: Derive the effective `belongsTo` requiredness from local relation column nullability when the user omits `required`.

## Detailed Design

### Public API

The public `belongsTo` API keeps the same option shape:

```ts
interface BelongsToOptions {
  required?: boolean;
  columns: string[];
  references: string[];
}
```

The meaning of omitted `required` changes:

- `required: true` keeps forcing the relation to be required.
- `required: false` keeps forcing the relation to be optional, even when all local relation columns are non-nullable.
- omitted `required` infers `true` when every key in `columns` points to a non-nullable column in the current table.
- omitted `required` infers `false` when at least one key in `columns` points to a nullable column in the current table.

The inferred value must affect every public behavior currently controlled by `required`:

- selected and joined `belongsTo` result types
- `queryRelated` result types
- relation query return mode, including `take` versus `takeOptional` behavior
- nested create input typing that currently requires either the foreign-key columns or the relation object for required `belongsTo`
- chained and through relation typing where `belongsTo` requiredness is propagated today

The default is based only on local `columns`, because those are the columns whose nullability determines whether the current row can point to no related row.

### Shared State or Data Shape

`belongsTo` should have one effective requiredness value after relation options are normalized or applied:

- explicit `options.required` when it is a boolean
- otherwise, an inferred boolean computed from the current table column shape and the relation `columns`

The effective value should be used consistently anywhere the relation currently reads `options.required`. It should not require users to see a new public option or new metadata field.

For type-level inference, nullable columns can be detected from column metadata already present on the column type. Runtime inference should use the corresponding column data that is available on the current table shape. The implementation should prefer direct nullability metadata such as `data.isNullable` over broad create-input optionality, because `data.optional` also covers defaults.

### Integration and Lifecycle

`belongsTo` relation definitions are still written on table classes with `this.belongsTo`. Requiredness inference must happen early enough that both type-level relation data and runtime query setup observe the same effective value.

At runtime, applying relations should call the required relation path when the effective requiredness is true and the optional path when it is false. This preserves the current SQL and result behavior for relations that already specify `required: true`, while changing omitted-`required` non-nullable relations to behave as required.

This is not only a TypeScript inference change. `required: true` already has runtime effects for `belongsTo`, such as configuring the related query as required instead of optional. When all local `columns` are non-nullable and `required` is omitted, those runtime effects must be applied exactly as they are for an explicit `required: true`.

Migration pull and code generation may continue to omit `required` for generated `belongsTo` definitions. Generated relations backed by non-nullable local foreign-key columns should become required through the same inference.

### Composite-Key Behavior

For a composite `belongsTo`:

- all local `columns` non-nullable means the omitted `required` default is true
- any local `columns` entry nullable means the omitted `required` default is false
- `references` nullability is ignored for this decision

This applies equally to one-column and many-column relations.

### Error Handling and Limits

- No new public error type is required.
- Invalid relation column names should keep failing through the existing TypeScript constraints and existing runtime assumptions.
- The change does not add runtime validation that the related record exists.
- The change does not alter `hasOne`, `hasMany`, `hasAndBelongsToMany`, or through-relation option defaults except where they consume an already-defined `belongsTo` relation's effective requiredness.

### Documentation

The relations guide should show that `belongsTo` normally does not need `required: true` when the local foreign-key column is non-nullable. It should also show that nullable local foreign-key columns keep the relation optional by default and that `required: false` is available for unusual schemas where the column is non-nullable but the application must treat the relation as optional.
