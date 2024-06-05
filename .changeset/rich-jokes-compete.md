---
'orchid-orm': minor
'rake-db': minor
---

Default rake-db `createView` to `securityInvoker: true` so views over RLS-managed tables use caller permissions and caller policies unless explicitly opted out with `securityInvoker: false` (#611)
