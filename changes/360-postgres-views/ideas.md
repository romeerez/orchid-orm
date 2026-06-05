# Postgres Views

## Must haves

### 1. Type-safe read-only query objects with `writable: false`

- Why: Views are often queryable but not safely writable, and the current query builder treats a view-backed class like a normal table with insert, update, and delete APIs.
- Adds: A table-like object can keep the normal read query API while making mutative operations unavailable at the TypeScript level.
- How: Users can mark a table/view definition as non-writable, and Orchid removes insert, update, delete, and other mutative methods from that query object while preserving selects, joins, relations where valid, and column typing.
- Depends on: None.

#### Use cases

- A project already has a database view represented as a normal Orchid table class. Marking it with `writable: false` prevents accidental writes without forcing the user to wait for the full first-class view API.

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
- Depends on: Type-safe read-only query objects with `writable: false`, Reliable regular view migrations in rake-db.

#### Use cases

- A user defines an `activeUsers` view from a filtered `users` table and queries it through the ORM without exposing table-style create or delete APIs by default.

### 5. Explicit write opt-in for updatable regular views

- Why: PostgreSQL can write through some regular views, but that depends on the exact view shape, triggers, rules, privileges, and RLS context, so Orchid should not infer safe writes from SQL alone.
- Adds: Users can intentionally expose write APIs for regular views that PostgreSQL can actually modify.
- How: A view declaration can opt into write support with one relation-level setting for v1. Computed or otherwise non-updatable columns remain expressible with the existing `readOnly()` column modifier. For filtered views, users can choose `CASCADED`, `LOCAL`, or no `WITH CHECK OPTION` behavior.
- Depends on: First-class regular view definitions in orchid-orm.

#### Use cases

- A user creates an automatically updatable filtered view for active records. Enabling write support exposes mutations, and `WITH CASCADED CHECK OPTION` prevents writes that would immediately disappear from the view.

### 6. First-class materialized view definitions in orchid-orm

- Why: Materialized views should be queryable in application code but must not expose normal write APIs because PostgreSQL does not allow direct user writes to them.
- Adds: Users can declare materialized views as ORM schema objects with read-only query APIs and migration-generator support.
- How: Users define materialized views separately from regular views, with a query definition, columns, dependencies, indexes, and creation options. The migration generator can reconcile declared materialized views with database state.
- Depends on: Type-safe read-only query objects with `writable: false`, Materialized view migrations in rake-db.

#### Use cases

- A user defines a `monthlySalesSummary` materialized view, queries it through Orchid like a table, and relies on the generated API to prevent accidental inserts or updates.

## Valuables

### 7. View security and RLS options as prominent view features

- Why: PostgreSQL views can run under owner privileges by default, which can surprise applications that expect caller permissions and row-level security policies to apply.
- Adds: Users get explicit, discoverable controls for security-sensitive view behavior instead of treating it as raw SQL trivia.
- How: View declarations surface `securityInvoker` and `securityBarrier` options directly. Docs explain when to use `securityInvoker: true` for views over RLS-managed tables, when `securityBarrier` helps with row-filtering views, and how view `WITH CHECK OPTION` differs from table policy `WITH CHECK`.
- Depends on: First-class regular view definitions in orchid-orm, Reliable regular view migrations in rake-db.

#### Use cases

- A multi-tenant app defines a view over RLS-managed tables and opts into `securityInvoker: true` so the invoking user's base-table permissions and RLS policies are respected.

### 8. Introspection metadata for view capabilities and state

- Why: PostgreSQL catalogs expose useful view facts, but generated application write APIs should remain conservative unless users deliberately opt in.
- Adds: Users can see what PostgreSQL reports about a view without Orchid silently changing the public API surface based on inferred capabilities.
- How: Pull/introspection records regular view metadata such as whether PostgreSQL reports the view as updatable or insertable, and materialized view metadata such as whether it is populated, has indexes, and what definition PostgreSQL reports.
- Depends on: Reliable regular view migrations in rake-db, Materialized view migrations in rake-db.

#### Use cases

- A user pulls an existing database and sees that PostgreSQL considers a regular view insertable, but the generated ORM definition still requires an explicit write opt-in before mutations become available.

### 9. Identity and relationship annotations for views

- Why: Views often lack inferable primary keys, unique constraints, and foreign keys, but ORM users still need identity information for relations, pagination, and unique lookups.
- Adds: Users can supply the metadata Orchid needs when a view should participate in ORM features that normally depend on table constraints.
- How: View definitions allow explicit identity, uniqueness, or relationship annotations where PostgreSQL metadata cannot prove them. These annotations describe ORM/query behavior without pretending the view has physical table constraints.
- Depends on: First-class regular view definitions in orchid-orm.

#### Use cases

- A view exposes one row per user and includes `userId`; the user marks it as the view identity so relations and unique lookups can work predictably.

### 10. Materialized view refresh ergonomics and constraints

- Why: Materialized views are valuable for performance, but refresh behavior has important stale-data and locking rules that users must not miss.
- Adds: Users get a clear refresh workflow that exposes PostgreSQL's `WITH DATA`, `WITH NO DATA`, and `CONCURRENTLY` tradeoffs.
- How: Runtime or migration refresh helpers accept refresh options and document or surface PostgreSQL constraints: concurrent refresh needs a suitable unique index, cannot use `WITH NO DATA`, requires an already populated materialized view, and only one refresh can run at a time per materialized view.
- Depends on: Materialized view migrations in rake-db, First-class materialized view definitions in orchid-orm.

#### Use cases

- A dashboard refreshes a populated materialized view concurrently during normal operation and uses a non-concurrent refresh during setup before the view is scannable.

## Nice to have

### 11. Safe handling for externally managed views

- Why: Existing projects may already manage views with raw SQL, grants, triggers, rules, or external migration tools, and generated migrations should not unexpectedly drop or replace them.
- Adds: Users can adopt first-class view support gradually without losing control of advanced or externally managed database objects.
- How: Orchid keeps raw SQL migrations available for unusual view designs and avoids destructive generated changes to unmanaged views unless the user has opted into Orchid-managed view state or an ignore workflow says otherwise.
- Depends on: Reliable regular view migrations in rake-db, Materialized view migrations in rake-db.

#### Use cases

- A project has a complex trigger-updatable view managed by hand-written SQL. Orchid can still query it as a read-only or explicitly writable object without trying to own all of its DDL.
