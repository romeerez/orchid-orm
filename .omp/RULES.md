# Project Rules

- After changing any published package under `packages/`, or `packages/test-utils`, always run `pnpm verify` before finishing. This does not apply to private packages such as benchmarks, repro, or test-builds.
- Public APIs must be fully type-safe. Cover non-trivial public type mappings with `assertType` tests and rejected inputs with `@ts-expect-error`; internal typing may be relaxed when the public contract remains sound.
- Test public API and observable behavior, not internal implementation.
- Preserve the dependency direction: `pqb` is the core; `orm`, `rake-db`, schema configs, and `test-factory` may depend on it, never the reverse. Cross-package internal `pqb` APIs go through `pqb/internal`, not deep imports.
- Prefer simple, clear, concise code. Refactor duplicated or generated code and structure modules and functions by responsibility.
- Use non-watch package checks: `pnpm <package-alias> check <path/to/file.test.ts>`. Do not use `test` or `t` in agent verification.
