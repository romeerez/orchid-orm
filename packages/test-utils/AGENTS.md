# Adapter-aware database tests

`src/test-utils.ts` owns the first-party adapter selection used by DB-backed tests.

- `ADAPTER` selects the adapter for one test process; omitting it selects `postgres-js`.
- The adapter registry is the single source of truth for supported test adapter ids and their `createDb`, ORM, and rake-db constructors. Register a new adapter there before adding package-specific coverage.
- Test helpers are singleton adapter-backed exports created when the module loads. Do not switch adapters within a running Jest process; rerun the suite in a separate process instead.
- The adapter matrix applies to DB-backed packages: `pqb`, `orm`, `rake-db`, and `test-factory`. `scripts/verify.ts` runs their affected tests sequentially under the default adapter, `node-postgres`, and Bun when an adapter implementation changes.
- Keep the no-env command as the fastest local loop. Use `ADAPTER=<id>` with the package's regular `check` command for a targeted driver run; Bun uses its `bun:check` command.
- Unknown adapter ids must fail before tests execute and list every valid id.
