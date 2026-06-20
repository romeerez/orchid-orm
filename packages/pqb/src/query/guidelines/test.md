Apply these rules only when writing tests inside `packages/pqb/src/query/`.

Treat every rule in this file as mandatory for every test change in that directory.

- `never`, `do not`, `must`, and the ordered checks below are hard stops.
- There are no exceptions for private, internal, helper-only, temporary, or one-file-local tests.

## Test public behavior, not SQL helpers

Do not test SQL-composing functions directly.

SQL helpers are implementation details. Tests should exercise the public methods users can call and assert the behavior they observe, including generated SQL only through that public path.

When a SQL helper has important branches, cover those branches by calling the public query method that uses it. If no public method can reach a branch, that is a design/testing signal: decide whether the branch is dead code or whether the public API needs coverage, but do not add direct helper tests as a shortcut.
