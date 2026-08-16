## Summary

Complete nested relation `upsert` support outside `hasMany`. `hasAndBelongsToMany` (HABTM) must support one or many upsert items in every parent mutation context; `belongsTo` and `hasOne` must support one upsert item in parent create and parent upsert, matching their existing single-record parent-update support.

```ts
await db.post.find(1).upsert({
  update: { title: 'existing post' },
  create: {
    title: 'new post',
    tags: {
      upsert: [
        {
          findBy: { id: 1 },
          update: { name: 'updated tag' },
          create: { name: 'created tag' },
        },
        {
          findBy: { id: 2 },
          update: { name: 'another updated tag' },
          create: { name: 'another created tag' },
        },
      ],
    },
  },
});
```

## What Changes

- Add HABTM nested upsert to parent create data, with single-object and array input, including its multi-query nested-create path.
- Extend HABTM nested update upsert from a single object to a single object or an array.
- Add HABTM nested upsert to the create branch of a parent upsert, with single-object and array input.
- Add single-object nested upsert to parent create data and parent-upsert create data for `belongsTo` and `hasOne`.
- Update relation-query documentation and the existing release changeset.

## Assumptions

- `hasMany` is the behavioral baseline. Its `findBy`, `update`, optional `create`, and lazy-create-callback contract is reused for HABTM.
- A nested relation upsert in parent-upsert `create` data runs only when the parent insert branch wins; it must never write related or join-table rows when the parent update branch wins.
- Only HABTM gains multi-query nested-create support in this change. The new to-one create-context upserts cover the CTE-backed path and do not extend their multi-query nested-create path.

## Capabilities

No standalone capability is added; this completes existing nested relation-upsert surfaces.

## Detailed Design

### Current Coverage and Target

The current relation tests establish the following support matrix. “Single” means one `upsert` object; “Array” means `upsert` also accepts multiple objects.

| Relation    | Parent create | Single-record parent update | Parent upsert create branch | Upsert cardinality                                                |
| ----------- | ------------- | --------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `hasMany`   | supported     | supported                   | supported                   | Single or array in every context                                  |
| HABTM       | not supported | supported                   | not supported               | Single only in update; target is single or array in every context |
| `belongsTo` | not supported | supported                   | not supported               | Single only, by design                                            |
| `hasOne`    | not supported | supported                   | not supported               | Single only, by design                                            |

The existing `belongsTo`, `hasOne`, and HABTM update tests already cover updating an existing related row, creating a missing related row, lazy `create` callbacks, scoped relations, callbacks, and rejection in batch update. Those update semantics remain unchanged except that HABTM additionally accepts an array.

### Public API

HABTM gains the same collection-upsert shape as `hasMany` in parent create, parent update, and parent-upsert create data.

```ts
type HasAndBelongsToManyUpsert = {
  findBy: RelatedUniqueColumns;
  update: RelatedUpdateData;
  create?: RelatedCreateData | (() => RelatedCreateData);
};

// HABTM: upsert?: HasAndBelongsToManyUpsert | HasAndBelongsToManyUpsert[]
```

`belongsTo` and `hasOne` gain their existing to-one update shape in parent create data:

```ts
type ToOneUpsert = {
  update: RelatedUpdateData;
  create: RelatedCreateData | (() => RelatedCreateData);
};

// belongsTo and hasOne: upsert?: ToOneUpsert
```

- HABTM `findBy` remains constrained to the related query's unique-column input. Each item updates its matching related row or creates one when no row matches and `create` is provided, then connects the resulting row through the join table.
- HABTM accepts an object as a convenience form and an array for independent multiple upserts in every supported parent operation.
- To-one relations update the currently related row when present; otherwise they create and connect the supplied row using their existing foreign-key direction and replacement behavior.
- Arrays remain rejected at the TypeScript level for `belongsTo` and `hasOne`, including in batched parent creates.
- Existing read-only related-table restrictions continue to reject these nested actions.

### Unsupported Cases to Add

Each example below is a required end-state query because that relation/context combination is not supported today.

#### HABTM upsert in parent create

```ts
await db.post.create({
  title: 'Post',
  tags: {
    upsert: [
      {
        findBy: { id: 1 },
        update: { name: 'existing tag' },
        create: { name: 'created tag' },
      },
      {
        findBy: { id: 2 },
        update: { name: 'second existing tag' },
        create: { name: 'second created tag' },
      },
    ],
  },
});
```

The same data shape must work for parent `createMany`. HABTM must also perform it with the multi-query nested-create strategy when the parent row count exceeds `nestedCreateBatchMax`, preserving the correct join row for every parent/relation pair.

#### HABTM multiple upserts in parent update

```ts
await db.post.find(1).update({
  tags: {
    upsert: [
      {
        findBy: { id: 1 },
        update: { name: 'first updated tag' },
        create: { name: 'first created tag' },
      },
      {
        findBy: { id: 2 },
        update: { name: 'second updated tag' },
        create: { name: 'second created tag' },
      },
    ],
  },
});
```

The existing single-record parent-update restriction stays in effect; a batch parent update still rejects HABTM upsert.

#### HABTM upsert in parent upsert

```ts
await db.post.find(1).upsert({
  update: { title: 'existing post' },
  create: {
    title: 'new post',
    tags: {
      upsert: [
        {
          findBy: { id: 1 },
          update: { name: 'existing tag' },
          create: { name: 'created tag' },
        },
        {
          findBy: { id: 2 },
          update: { name: 'second existing tag' },
          create: { name: 'second created tag' },
        },
      ],
    },
  },
});
```

The relation and join-table writes execute only after the parent create CTE contains a row. When the parent upsert takes its update branch, the related tags and join table remain unchanged.

#### belongsTo upsert in parent create

```ts
await db.book.create({
  title: 'Book',
  author: {
    upsert: {
      update: { name: 'updated author' },
      create: { name: 'created author' },
    },
  },
});
```

#### belongsTo upsert in parent upsert

```ts
await db.book.find(1).upsert({
  update: { title: 'existing book' },
  create: {
    title: 'new book',
    author: {
      upsert: {
        update: { name: 'updated author' },
        create: { name: 'created author' },
      },
    },
  },
});
```

#### hasOne upsert in parent create

```ts
await db.user.create({
  name: 'User',
  profile: {
    upsert: {
      update: { bio: 'updated bio' },
      create: { bio: 'created bio' },
    },
  },
});
```

#### hasOne upsert in parent upsert

```ts
await db.user.find(1).upsert({
  update: { name: 'existing user' },
  create: {
    name: 'new user',
    profile: {
      upsert: {
        update: { bio: 'updated bio' },
        create: { bio: 'created bio' },
      },
    },
  },
});
```

### Integration and Lifecycle

- For every newly supported CTE-backed create path, use the parent create CTE and selected parent keys to bind relation writes to the exact created parent row. The child update branch and child insert branch must both be guarded so a parent-upsert update branch performs no nested write.
- HABTM performs the related-row upsert and then writes the matching join row for both found and newly created related rows. It must not duplicate a join row or run the related-row upsert outside the parent-create guard.
- `belongsTo` and `hasOne` reuse the current one-record nested-upsert semantics when choosing between the existing related row and `create` data. Their requiredness, nullable foreign key, scoped-relation `on`, callback, and replacement behavior are unchanged.
- HABTM's non-CTE multi-query nested-create path must mirror `hasMany` behavior for each parent row and each upsert item. No comparable multi-query extension is required for the new to-one forms.

### Error Handling and Limits

- A lazy `create` callback runs only when the related row is missing, as in existing nested upsert behavior.
- If a HABTM upsert item has no match and omits `create`, no related row or join row is created; this matches `hasMany`.
- Existing unique-input validation, relation callbacks, transaction boundaries, and database errors are preserved.
- HABTM upsert remains unavailable for a batch parent update. To-one upsert stays object-only and retains its current batch-update rejection.

### Documentation

Update `relation-queries.md` to distinguish the now-complete matrix from the former update-only coverage:

- show that all direct relations support nested upsert in parent create, eligible single-record parent update, and a parent upsert's create branch;
- show that `hasMany` and HABTM accept one item or an array, while `belongsTo` and `hasOne` accept one object only;
- retain the unique-`findBy`, lazy-create, read-only, and single-record-update constraints, including the continued ban on collection upsert in batch parent updates.
