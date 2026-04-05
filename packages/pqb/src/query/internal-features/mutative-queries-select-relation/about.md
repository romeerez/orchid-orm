# Mutative Queries Select Relations

## Purpose

This is a primarily internal pqb feature that makes relation selects work on mutative queries. It exists because `insert`, `update`, and `delete` can return columns from the mutated table directly, but relation data needs extra handling. For `insert` and `update`, the feature detects when `.select(...)` includes relations, preserves primary keys in the mutation result, wraps execution in a transaction, and runs a follow-up select so the final result can include related records with the same shape the user selected.

`delete` is handled differently. Because the source row may be gone after the mutation, the feature builds a CTE that captures the affected primary keys and requested relation payload, then deletes by joining against the keys from that CTE so relation data can be returned from the same SQL statement.

## Use cases

- **Relation selects after create and update**: Enables public APIs such as `insert`, `create`, `insertMany`, and `update` to return related data immediately after the mutation.
  How: The select layer marks relation subqueries, mutation SQL keeps primary keys in the result, and `then` runs the mutation and follow-up relation query in one transaction before merging relation JSON into the final payload.

- **Atomic delete with relation loading**: Enables `delete().select({...relation...})` to return relations even after the source row was deleted or soft-deleted.
  How: The delete SQL path builds a CTE that captures affected primary keys together with the requested relation data, then deletes by joining back to those keys and returns the relation payload from that same statement.

- **Shared support for higher-level mutation flows**: Extends the same behavior to mutation-backed APIs such as the tested find branch of `orCreate`, the update branch of `upsert`, and batched `insertMany`.
  How: The feature plugs into shared mutation SQL and `then` handling, so those higher-level flows reuse the same relation-loading step instead of implementing their own.

Note: `upsert` and `orCreate` are not yet fully supported for relation selects.

## Used by

- Relation-aware select processing in `basic-features/select`
- Mutation SQL builders for `insert`, `update`, and `delete`
- Query execution in `then`, which performs the follow-up relation load and merge for insert/update

## Dependencies

- Primary-key utilities in `query-columns/primary-keys`
- Subquery, CTE, and hook-select helpers used to preserve row identity through mutation SQL, especially for delete
- Scope and `then` execution helpers used for the insert/update follow-up relation query inside the same transactional flow
