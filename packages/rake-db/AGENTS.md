# rake-db Guidance

## Interactive prompts

Every interactive question, including those asked by the ORM migration
generator, goes through `src/prompt.ts`. Without a TTY a prompt must reject
with `RakeDbError` before touching stdin, so the CLI exits with code 1 instead
of waiting for input that never arrives.

Command and generator tests mock the prompt functions, so they cannot catch a
regression in this behavior. Cover it in `src/prompt.test.ts` by toggling
`process.stdin.isTTY`.
