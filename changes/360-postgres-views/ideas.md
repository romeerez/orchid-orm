# Postgres Views

## Must haves

### 1. Type-safe read-only query objects with `readOnly: true`

- Why: Views are often queryable but not safely writable, and the current query builder treats a view-backed class like a normal table with insert, update, and delete APIs.
- Adds: A table-like object can keep the normal read query API while making mutative operations unavailable at the TypeScript level.
- How: Users can mark a table/view definition as read-only, and Orchid removes insert, update, delete, and other mutative methods from that query object while preserving selects, joins, relations where valid, and column typing.
- Depends on: None.

#### Use cases

- A project already has a database view represented as a normal Orchid table class. Marking it with `readOnly: true` prevents accidental writes without forcing the user to wait for the full first-class view API.

### 2. Reliable regular view migrations in rake-db

- Why: Manual regular-view migration support already exists, but generated migrations need to preserve the documented option shape and make view changes visible to users.
- Adds: Users can create, drop, pull, and generate migrations for regular views without hand-fixing generated option code or missing view changes in migration summaries.
- How: Regular view migrations continue to use the existing `createView` and `dropView` workflow, including explicit columns, dependencies, recursive views, `WITH CHECK OPTION`, `securityBarrier`, and `securityInvoker`. Pulled/generated code should round-trip through the same documented API shape.
- Depends on: None.

#### Use cases

- A user pulls a database view with `security_invoker` and a `LOCAL CHECK OPTION`; the generated migration should show those options in a form that can be run back through rake-db.

### 3. Materialized view migrations in rake-db

- Why: Materialized views are a distinct PostgreSQL object with table-like storage, indexes, refresh behavior, and no direct insert/update/delete support.
- Adds: Users can manage materialized views in migrations instead of relying on raw SQL for common lifecycle operations.
- How: Migration writing supports creating and dropping materialized views, choosing whether creation includes data, adding indexes on materialized views, and refreshing them with `concurrently` or `withData` options where PostgreSQL allows it.
- Depends on: None.

#### Use cases

- A reporting feature creates a materialized view for expensive aggregate data, adds a unique index needed for concurrent refreshes, and refreshes it from a migration or maintenance workflow.

### 4. First-class regular view definitions in orchid-orm

- Why: Users currently model a view by defining a normal table class with the view name and columns, which hides the fact that the database object is a view and gives it the wrong default write semantics.
- Adds: Regular views become explicit schema objects that can be queried like tables but default to read-only behavior.
- How: Users define a view next to table definitions with its name, columns, SQL expression, dependencies, and view options. The generated query API is read-only by default, with an explicit write opt-in for views the user knows PostgreSQL can update.
- Depends on: Type-safe read-only query objects with `readOnly: true`, Reliable regular view migrations in rake-db.

#### Use cases

- A user defines an `activeUsers` view from a filtered `users` table and queries it through the ORM without exposing table-style create or delete APIs by default.

### 5. First-class materialized view definitions in orchid-orm

- Why: Materialized views should be queryable in application code but must not expose normal write APIs because PostgreSQL does not allow direct user writes to them.
- Adds: Users can declare materialized views as ORM schema objects with read-only query APIs and migration-generator support.
- How: Users define materialized views separately from regular views, with a query definition, columns, dependencies, indexes, and creation options. The migration generator can reconcile declared materialized views with database state.
- Depends on: Type-safe read-only query objects with `readOnly: true`, Materialized view migrations in rake-db.

#### Use cases

- A user defines a `monthlySalesSummary` materialized view, queries it through Orchid like a table, and relies on the generated API to prevent accidental inserts or updates.
