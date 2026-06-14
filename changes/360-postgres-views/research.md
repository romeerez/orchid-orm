# Postgres Views

## Purpose and goals

Research how orchid-orm should model PostgreSQL views in user-facing table/query APIs and migration generation.

Goals:

- Represent regular and materialized views without pretending they have the same write semantics as base tables.
- Default to safe read-only behavior when the ORM cannot reliably prove that a view is insertable or updatable from a user-provided SQL definition.
- Allow explicit user opt-in for insert/update/delete support on views that PostgreSQL can actually modify.
- Support view-specific PostgreSQL options that affect correctness and security, especially `WITH CHECK OPTION`, `security_barrier`, `security_invoker`, and materialized view refresh behavior.
- Clarify how views interact with row-level security policies on underlying tables.

## Valuable external context

PostgreSQL regular views are virtual relations defined by `CREATE VIEW name AS query`. The current PostgreSQL syntax also supports `OR REPLACE`, `TEMP` / `TEMPORARY`, `RECURSIVE`, explicit column names, view options via `WITH (...)`, and `WITH [ CASCADED | LOCAL ] CHECK OPTION`.

Simple regular views are automatically updatable. PostgreSQL allows `INSERT`, `UPDATE`, `DELETE`, and `MERGE` on an automatically updatable view when the view satisfies these conditions:

- Exactly one top-level `FROM` item, and that item is a table or another updatable view.
- No top-level `WITH`, `DISTINCT`, `GROUP BY`, `HAVING`, `LIMIT`, or `OFFSET`.
- No top-level set operations such as `UNION`, `INTERSECT`, or `EXCEPT`.
- No aggregate functions, window functions, or set-returning functions in the select list.

Automatically updatable views may mix writable and read-only columns. A column is writable only when it is a simple reference to a writable column of the underlying relation. Computed columns, expressions, and subqueries in the select list are read-only even if the view as a relation supports writes.

Complex regular views are read-only by default. PostgreSQL can still make them writable with `INSTEAD OF` triggers or rewrite rules, but triggers are easier to reason about and `MERGE` is not supported on relations with rules.

`WITH CHECK OPTION` applies only to automatically updatable views without `INSTEAD OF` triggers or `INSTEAD` rules. It rejects `INSERT`, `UPDATE`, and `MERGE` changes that would produce rows not visible through the view. Without it, PostgreSQL can accept writes through a filtered view that insert or update rows so they do not satisfy the view predicate. `CASCADED` checks the current view and all underlying base views, and is the default when `CHECK OPTION` is provided without `LOCAL` or `CASCADED`. `LOCAL` checks only predicates defined directly on the current view, except where underlying views also define their own check option. `CHECK OPTION` is not allowed on recursive views, and check options can be ignored when rules rewrite the write query.

Materialized views are created with `CREATE MATERIALIZED VIEW ... AS query [ WITH [ NO ] DATA ]`. They persist query results in table-like storage and can be indexed, but PostgreSQL does not allow direct user `INSERT`, `UPDATE`, or `DELETE` against the materialized view. The stored query is retained so the data can be replaced with `REFRESH MATERIALIZED VIEW`.

`REFRESH MATERIALIZED VIEW` replaces all stored contents. `WITH DATA` leaves the materialized view scannable; `WITH NO DATA` leaves it unscannable until refreshed with data. `CONCURRENTLY` avoids blocking concurrent reads but requires at least one unique index that uses only column names and includes all rows, cannot be combined with `WITH NO DATA`, can be used only on an already-populated materialized view, and only one refresh can run at a time per materialized view.

PostgreSQL catalogs expose view metadata that can help introspection but do not remove the need for conservative ORM behavior:

- `pg_class.relkind` distinguishes ordinary tables (`r`), regular views (`v`), and materialized views (`m`).
- `information_schema.views` exposes `check_option`, `is_updatable`, `is_insertable_into`, and trigger-based insert/update/delete indicators for regular views visible to the current user.
- `pg_views` exposes regular view owner and reconstructed `SELECT` definition.
- `pg_matviews` exposes materialized view owner, tablespace, whether it has indexes, whether it is populated, and reconstructed `SELECT` definition.
- `pg_class.reloptions` stores view options such as `security_barrier=true` and `security_invoker=true`.

View permissions and RLS behavior are security-sensitive. By default, access to underlying base relations referenced by a view is checked using the view owner's privileges, not the invoking user's privileges. For base tables with row-level security enabled, the policies applied through a default view are also the policies that apply to the view owner. A view created with `security_invoker=true` instead checks underlying relation permissions and RLS policies as the invoking user, as if the user directly queried the base relations. This affects both reads and writes through updatable views.

Views can be used as a security boundary, but filtered views are not reliable for concealing unseen rows unless created with `security_barrier`. Without `security_barrier`, the planner may evaluate user-supplied non-leakproof functions before the view predicate and leak values from rows that the view intended to hide. `security_barrier` improves this but can reduce optimization opportunities and performance. Even a security-barrier view is not a complete defense against all inference channels.

RLS policies themselves have separate `USING` and `WITH CHECK` expressions. `USING` filters visible or modifiable existing rows, while `WITH CHECK` validates inserted or updated rows and raises an error when false or null. If no applicable policy exists on an RLS-enabled table, PostgreSQL applies default deny. For policies that can use both expressions, PostgreSQL uses `USING` as the `WITH CHECK` expression when no separate check is specified.

Established tools generally choose conservative write behavior for views:

- Prisma introspects views for PostgreSQL and exposes them for reads, but disables generated create/update/delete/upsert APIs for all views regardless of whether the database supports updatable views. Prisma currently does not support materialized views directly and suggests raw SQL for refreshing them.
- TypeORM maps views with `@ViewEntity`, requires an expression, treats view columns as read-only, and supports `materialized: true` plus indexes for PostgreSQL materialized views with limited index options.
- SQLAlchemy reflection separates regular and materialized views, can retrieve view definitions, and treats views as table-like reflection targets, but users commonly need to supply primary-key/constraint metadata manually when mapping a view as an ORM entity.

## Community ideas and pain points

Useful product signals from established tooling:

- Users expect to query views like tables, but write support is risky because database capabilities vary and PostgreSQL write support depends on the exact view shape, triggers, rules, privileges, and RLS context.
- Materialized views are commonly used for performance and reporting, but users need explicit refresh operations and must understand stale data and refresh locking semantics.
- Views do not inherently have primary keys, unique constraints, or foreign keys in the same way as tables. ORMs often need user-supplied identity metadata for relation mapping, `findUnique`-style APIs, pagination, or entity hydration.
- Introspection can discover that PostgreSQL currently considers a view updatable or insertable, but preserving type-safe application write APIs still requires a deliberate user contract because later SQL edits can silently change those capabilities.

## Requirements and edge cases

- Regular views should be read-only by default in ORM-generated APIs unless the user explicitly marks allowed write operations.
- A write opt-in can be a single relation-level flag for v1. PostgreSQL automatically updatable views generally expose normal write operations together, while per-column restrictions can be modeled with Orchid's existing `readOnly()` column modifier. Trigger/rule-updatable views are out of scope for the first view support design.
- `WITH CHECK OPTION` should be considered the safe default for ORM-managed updatable filtered views because otherwise writes can create rows that disappear from the same view. This default only makes sense when PostgreSQL accepts it: automatically updatable, non-recursive views without `INSTEAD OF` triggers or `INSTEAD` rules.
- The API should allow choosing `CASCADED`, `LOCAL`, or no check option. If the user says only `check: true`, `CASCADED` matches PostgreSQL's default and is safest for view stacks.
- The API should not imply that `CHECK OPTION` replaces RLS. `CHECK OPTION` validates view visibility predicates; RLS policies validate table access and row checks according to the active role/policy context.
- Security-related options should be explicit: `security_barrier` for views intended as row filters/security boundaries, and `security_invoker` for views that should respect the caller's base-table privileges and RLS policies.
- Default `security_invoker` is PostgreSQL's owner-based behavior, which can bypass caller RLS expectations when the view owner has broader access. This should be documented prominently.
- Materialized views should be queryable but not insertable/updatable/deletable through ORM APIs.
- Materialized view support should include whether the view is created with data, whether it is currently populated when introspected, refresh operations, optional concurrent refresh, and index support.
- Concurrent materialized refresh should surface PostgreSQL constraints: requires a suitable unique non-partial, non-expression index, cannot run on an unpopulated view, cannot be combined with `WITH NO DATA`, and only one refresh may run for a view at a time.
- `CREATE OR REPLACE VIEW` preserves ownership, permissions, and non-SELECT rules while replacing the defining SELECT rule, view options, and check option. Migration behavior should not accidentally promise a full replacement of all related metadata.
- `CREATE VIEW` with `SELECT *` captures the columns present at creation time; later base table columns are not automatically added to the view definition.
- View column nullability, identity, uniqueness, and relationships may not be inferable from PostgreSQL metadata and may need explicit user annotations.
- Introspection should distinguish regular views from materialized views and base tables by relation kind.
- Introspection can record PostgreSQL-reported `is_updatable`, `is_insertable_into`, and trigger-based capabilities as metadata, but generated user-facing APIs should remain conservative unless the project chooses explicit opt-in generation.
- Temporary views exist in PostgreSQL but likely should not be part of persistent migration generation unless orchid-orm has a general temporary-object story.
- Recursive views exist and should be read-only by default; they cannot use `CHECK OPTION`.

## Existing support in orchid-orm

This feature already exists only partially.

Existing regular-view support:

- `rake-db` has migration methods `createView` and `dropView`.
- `createView` supports regular PostgreSQL view options: `createOrReplace`, `temporary`, `recursive`, explicit `columns`, `dropIfExists`, `dropMode`, and nested `with` options for `checkOption`, `securityBarrier`, and `securityInvoker`.
- `rake-db` introspection reads non-temporary regular views from `pg_class`/`pg_rewrite`, including dependencies, columns, `pg_get_viewdef`, recursive marker, and `reloptions`.
- `structureToAst` converts introspected view `reloptions` such as `check_option=LOCAL`, `security_barrier=true`, and `security_invoker=true` into `RakeDbAst.ViewOptions`.
- `pull` and migration AST generation can include view AST items.
- Docs include `createView`/`dropView` in manual migration writing.
- Test fixtures define `activeUserWithProfile` as a normal ORM table class pointing at a database view, and `packages/orm/src/view.test.ts` verifies that the view can be queried like a normal table.

Current limitations:

- There is no first-class ORM table-class/view-class distinction. A view-backed query is represented by defining a normal table class with the view name and columns.
- Because a view-backed table class is currently just a table from the query builder's perspective, normal write APIs are not disabled by default for views.
- There is no user-facing write opt-in contract for regular views. Orchid cannot currently express that a view-backed query should be read-only by default or explicitly writable when the user knows the PostgreSQL view is automatically updatable.
- Column-level `readOnly()` already exists and can model computed/read-only view columns manually, but there is no relation-level default that marks all view columns read-only.
- There is no materialized-view migration API such as `createMaterializedView`, `dropMaterializedView`, or `refreshMaterializedView`.
- Materialized views are not included in view introspection because the current view query filters `pg_class.relkind = 'v'`; materialized views use `relkind = 'm'`.
- A materialized view appears only incidentally in enum-recreation code, where `relkind IN ('r', 'm')` is used while altering columns that use enum types.
- The ORM migration generator appears table-class-driven and initializes `views: []` for table-based generation, so user-defined ORM schema does not currently declare views as desired schema objects.
- There is a likely shape mismatch in generated view migrations: `ast-to-migration` emits `checkOption`, `securityBarrier`, and `securityInvoker` at the top level of the options object, while `createView` and the docs expect those under `with`. This means pulled/generated view option code may not round-trip into the same SQL unless corrected.
- `report-generated-migration` currently ignores view AST items in its human-readable summary.

Existing RLS-related support:

- Docs state RLS support is work in progress.
- Table classes can declare table-level RLS flags with `defineRls({ enable, force })`.
- `orchidORM` accepts `rls.tableRlsDefaults`.
- Migration generation supports table-level RLS `enable` and `force` flags.
- Runtime APIs support SQL session context for RLS: `$withOptions({ role, setConfig }, cb)` and `$transaction({ role, setConfig }, cb)`.
- Current RLS support does not yet include full policy declaration/generation in implemented code, though the `changes/611-row-level-security-integration` research and specs cover policy design.
- Existing RLS research already notes that views over RLS-managed tables need `securityInvoker` handling or documentation.

What this implies:

- View support should build on the existing `createView` syntax and `RakeDbAst.View` instead of inventing a separate model for regular views.
- A complete feature needs to split "database object kind" from "query API capabilities": regular views, materialized views, and tables are all queryable, but their write surfaces differ.
- The default ORM behavior for new first-class view declarations should be read-only, even though PostgreSQL may report a regular view as updatable or insertable.
- Existing manual migration support for `securityInvoker`, `securityBarrier`, and `checkOption` is a good foundation, but the API should make these options more prominent for view/RLS use cases.
- Materialized views need separate DDL and runtime operations because they are not just regular views with an option.

## Proposed user-facing design

Treat a view as a first-class queryable database object with conservative write behavior.

Regular views:

- Users should be able to define a regular view next to table definitions, with a name, columns, SQL expression, dependencies, and PostgreSQL view options.
- The default generated query API should support reads only.
- Users should opt into writes explicitly with a single relation-level writable/updatable flag for v1.
- If write support is enabled, users should mark computed or non-updatable columns with the existing `readOnly()` column modifier.
- For ORM-managed updatable filtered views, `WITH CASCADED CHECK OPTION` should be the safe default when check option is enabled implicitly by the write opt-in. Users should still be able to choose `LOCAL`, `CASCADED`, or disabled behavior.
- The docs should explain that `WITH CHECK OPTION` is not valid for recursive views and only works for automatically updatable views without `INSTEAD OF` triggers or `INSTEAD` rules.
- Migration generation should preserve existing `createView` ergonomics and generate the nested `with` option shape used by the migration runner.
- Introspection can record PostgreSQL's `is_updatable`, `is_insertable_into`, and trigger capability metadata, but generated ORM code should still require a deliberate user opt-in before exposing write methods.

Materialized views:

- Users should define materialized views separately from regular views, because creation, refresh, indexing, and write behavior are different.
- Materialized views should be queryable and always read-only through normal ORM write APIs.
- Migration writing should support `createMaterializedView`, `dropMaterializedView`, and indexes on materialized views.
- Runtime or migration helpers should support `refreshMaterializedView` with options for `concurrently` and `withData`.
- The API should surface PostgreSQL's concurrent-refresh constraints in docs and, where practical, runtime validation or clear database-error context.
- Introspection should read materialized views from `pg_matviews` or `pg_class.relkind = 'm'`, including populated state, definition, tablespace, columns, dependencies, and indexes.

RLS and security:

- View declarations should expose `securityInvoker` and `securityBarrier` as first-class options, not as obscure raw SQL escapes.
- Docs should state that default PostgreSQL views use the owner privilege/RLS context for underlying tables, which can surprise apps expecting caller RLS policies to apply.
- Orchid should preserve PostgreSQL defaults for `securityInvoker` and `securityBarrier` unless the user opts into a security preset. For views over RLS-managed tables, docs and examples should recommend `securityInvoker: true` unless the user intentionally wants a privilege-defining view.
- `securityBarrier` should be recommended when a view is intended to hide rows as a security boundary, with a note about possible performance cost and incomplete protection from inference.
- RLS docs should link to view docs and call out the difference between table policy `WITH CHECK` and view `WITH CHECK OPTION`.

Compatibility with current Orchid behavior:

- Existing users who manually define view-backed table classes should not be broken.
- A new first-class view API can coexist with normal table classes and gradually become the documented path.
- Manual raw SQL migrations should remain supported for advanced trigger-updatable views, rules, grants, and unusual security-definer designs.
- Generated migrations should avoid dropping externally managed views unless the user has opted into Orchid-managed view state or the pull/generation workflow has an ignore story.

## References

- PostgreSQL `CREATE VIEW`: https://www.postgresql.org/docs/current/sql-createview.html
- PostgreSQL `CREATE MATERIALIZED VIEW`: https://www.postgresql.org/docs/current/sql-creatematerializedview.html
- PostgreSQL `REFRESH MATERIALIZED VIEW`: https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html
- PostgreSQL materialized views overview: https://www.postgresql.org/docs/current/rules-materializedviews.html
- PostgreSQL rules and privileges for views: https://www.postgresql.org/docs/current/rules-privileges.html
- PostgreSQL row security policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL `CREATE POLICY`: https://www.postgresql.org/docs/current/sql-createpolicy.html
- PostgreSQL `information_schema.views`: https://www.postgresql.org/docs/current/infoschema-views.html
- PostgreSQL `pg_class`: https://www.postgresql.org/docs/current/catalog-pg-class.html
- PostgreSQL `pg_views`: https://www.postgresql.org/docs/current/view-pg-views.html
- PostgreSQL `pg_matviews`: https://www.postgresql.org/docs/current/view-pg-matviews.html
- Prisma views documentation: https://docs.prisma.io/docs/orm/prisma-schema/data-model/views
- TypeORM view entities documentation: https://typeorm.io/docs/entity/view-entities/
- SQLAlchemy reflection documentation: https://docs.sqlalchemy.org/en/20/core/reflection.html
