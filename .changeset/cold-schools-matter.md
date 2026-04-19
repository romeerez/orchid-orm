---
'rake-db': minor
'orchid-orm': minor
'pqb': minor
---

Add explicit SQL session scope support via `$withOptions({ role, setConfig })` (#611).

This adds a new RLS-friendly capability:

- Set a Postgres role for a callback scope with `role`.
- Set request-scoped Postgres settings (such as `app.tenant_id`) with `setConfig`.
- Have those session values automatically applied to queries in that scope, including queries inside explicit transactions.
- Get automatic restoration of previous session values after the callback completes.

To keep behavior predictable, nested SQL session scopes are rejected: if an outer scope already defines `role` or `setConfig`, defining them again in an inner scope throws.
