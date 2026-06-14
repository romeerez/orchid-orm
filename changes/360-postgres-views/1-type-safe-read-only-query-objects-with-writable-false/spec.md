## Summary

Add an opt-in table-level `readOnly = true` flag that keeps normal read query APIs available while making mutation-only query APIs unavailable at the TypeScript level.

```ts
import { BaseTable, orchidORM } from 'orchid-orm';

class ReportTable extends BaseTable {
  readonly table = 'report';
  readonly readOnly = true;

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
  }));
}

const db = orchidORM(
  { databaseURL: process.env.DATABASE_URL },
  {
    report: ReportTable,
  },
);

await db.report.where({ id: 1 }).select('name');

await db.report.create({ id: 1, name: 'new' });
//          ^ TypeScript error: this table is read-only.

await db.report.find(1).update({ name: 'changed' });
//                    ^ TypeScript error: this table is read-only.

await db.report.find(1).delete();
//                    ^ TypeScript error: this table is read-only.
```

## What Changes

- Table classes may declare `readonly readOnly = true` to opt out of mutative query APIs.
- Tables without `readOnly` remain writable and preserve the current public API; the type mapping treats only the literal `true` as read-only.
- `pqb` query types carry a `readOnly` capability flag that mutation-only methods require to be `false`.
- ORM table-to-query mapping derives the query read-only capability flag from the table class and passes it into `Db`.
- The change does not alter migration generation, SQL generation, or runtime database behavior.

## Capabilities

- `query-read-only capability`: A type-level query capability flag that lets `pqb` distinguish queries that may expose mutation APIs from read-only queries.

## Detailed Design

### Public API

The public ORM table API gains one optional table-class property:

```ts
class SomeTable extends BaseTable {
  readonly table = 'some';
  readonly readOnly = true;

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));
}
```

- `readonly readOnly = true` is the only opt-in that changes behavior.
- Omitting `readOnly` means the table is writable, preserving current behavior.
- The option is table-level. It does not mark individual columns as read-only and does not replace the existing column-level `readOnly()` API.
- Read query APIs remain available, including selecting, filtering, ordering, joining, CTEs, transactions, logging, scopes, relation reads, computed columns, and query result typing.
- Mutative query APIs must be unavailable at the TypeScript level when the current query has `readOnly: true`.
- No runtime validation is required for this flag. Code that bypasses TypeScript with casts may still call the underlying JavaScript methods and receive current database behavior.

### Shared State or Data Shape

`pqb` query types gain a type-level read-only capability marker:

```ts
interface Query {
  readOnly: boolean;
}

interface MutableQuery {
  readOnly: false;
}
```

`Db` receives a new generic parameter for read-only capability and exposes it as the query's `readOnly` property:

```ts
class Db<
  Table,
  Shape,
  PrimaryKeys,
  UniqueColumns,
  UniqueColumnTuples,
  UniqueConstraints,
  ColumnTypes,
  ShapeWithComputed,
  Scopes,
  DefaultSelect,
  ReadOnly extends boolean = false,
> implements Query {
  declare readOnly: ReadOnly;
}
```

- `MutableQuery` is the reusable constraint for methods that require the current query object to be writable.
- Query cloning, narrowing, selecting, filtering, joining, relation traversal, and other read-oriented transformations must preserve the existing `readOnly` literal type.
- The marker is type metadata. It does not need to be stored in `q`, serialized into SQL, or propagated through migration AST structures.

### Integration and Lifecycle

ORM table mapping derives `Db` read-only capability from the table instance type:

```ts
type TableReadOnly<T extends ORMTableInput> = T['readOnly'] extends true
  ? true
  : false;
```

`TableToDb<T>` passes `TableReadOnly<T>` to the new `Db` generic.

- `ORMTableInput` accepts an optional `readOnly?: boolean | undefined` table property.
- `TableToDb` must use the literal table property type, so `readonly readOnly = true` produces a query with `readOnly: true`.
- Existing table classes that do not declare `readOnly` continue to map to `readOnly: false`.
- Standalone `pqb` tables created through `db.table(...)` or equivalent direct `Db` construction remain writable by default.

### Mutative Query Behavior

Every mutation entry point in `pqb` must require `MutableQuery` through its `this` type or shared self interface.

The write-gated surface includes:

- create/insert APIs: `create`, `insert`, `createMany`, `insertMany`, `defaults`, `createOneFrom`, `insertOneFrom`, `createManyFrom`, `insertManyFrom`, `createForEachFrom`, `insertForEachFrom`.
- insert conflict APIs: `onConflict`, `onConflictDoNothing`, and conflict update builders reachable from those APIs.
- update APIs: `update`, `updateOrThrow`, `updateFrom`, `set`, `increment`, `decrement`, `updateMany`, `updateManyOptional`, `updateManyBy`, `updateManyByOptional`.
- delete APIs: `delete`, `hardDelete`.
- combined create/update APIs: `upsert`, `orCreate`.
- table-wide mutation APIs: `truncate`.
- soft-delete table behavior: the soft-delete override of `delete` and the `hardDelete` method must not be callable on a query whose read-only capability is `true`.

For example, the existing `CreateSelf` shape should extend `MutableQuery`, so every create-family method that already uses `CreateSelf` becomes read-only-gated as a group. Equivalent shared constraints should be used for update, delete, upsert, soft-delete, and truncate surfaces instead of adding ad hoc checks per method.

Nested mutation APIs that are exposed through relation create/update data must follow from the same query read-only capability constraints. If a related table query has `readOnly: true`, relation callbacks must not make its create, update, delete, upsert, or equivalent mutation methods type-callable.

### Error Handling and Limits

- The feature is a TypeScript API restriction, not a database permission or runtime safety mechanism.
- No migration generator behavior changes when `readOnly = true` is added to a table class.
- No SQL output changes for read-only tables.
- Existing runtime errors for unsafe updates/deletes without `where`, read-only columns, relation constraints, database permissions, and PostgreSQL failures remain unchanged.
- TypeScript should reject mutation calls because the receiver does not satisfy `MutableQuery`; no new user-facing runtime error message is required.

### Documentation

Document the table-level `readOnly = true` option where table class properties are explained, with a short example showing that reads remain available and `create`, `update`, and `delete` are type errors. Call out that the option has no migration-generation effect and does not replace column-level `readOnly()`.
