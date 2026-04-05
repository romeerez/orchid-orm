---
description: Reproduce a reported issue by creating a failing test
---

# Reproduce Issue Command

Automates the reproduction of reported issues by creating an isolated failing test case. This enforces test-driven validation before attempting any fixes. **Violating the letter of these rules is violating the spirit of the command.**

**Input**: A GitHub issue number or URL, or a description of the bug. (e.g. `/repro #123` or `/repro https://github.com/romeerez/orchid-orm/issues/123`).

**Steps**:

1. **Understand Context**
   Use GitHub MCP to read the issue body and comments.

   - If the issue contains multiple distinct problems, you MUST create a separate test file for each problem, unless user requests otherwise via prompt.

2. **Review Template**
   ALWAYS read `packages/repro/src/repro-orm.example.test.ts` to see how ORM issues are reproduced. For non-ORM querying issues, use `https://orchid-orm.netlify.app/llms.txt` and adapt by analogy.

   - You MUST NOT modify `packages/repro/src/repro-orm.example.test.ts`. Use it purely as a reference.

3. **Create Test File(s)**
   Create a NEW, failing, self-contained test file in `packages/repro/src/`. You MUST NOT use or edit the example file.

   - The file must be named `<descriptive-name>-<issue-number>.test.ts` (e.g. `nested-select-bug-123.test.ts`). Create multiple files if there are multiple problems.
   - You can import from any orm-related packages (`orchid-orm`, `pqb`, `rake-db`, etc.).
   - The test should act closely on what the issue is about, using its described assertions. The test MUST initially fail.

4. **Verify Reproduction**

   - **For runtime issues:** Run `pnpm repro check packages/repro/src/<your-file>.test.ts`. It must fail at runtime.
   - **For TS typing issues:** Run `pnpm repro types`. It must fail at type checking (runtime failure is not required).
   - **For TS typing issues, use `assertType` from the `test-utils` package:**
     ```ts
     import { assertType } from 'test-utils';
     // assert that a type extends another type:
     assertType<typeof result, ExpectedType>();
     ```

5. **Limits on Attempts**
   Give up after a number of sincere attempts if it cannot be reproduced. Do not endlessly try to fix it.

## Common Rationalizations & Red Flags

| Excuse                              | Reality                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| "I'll just edit the example file"   | Editing the example ruins it for future tests. Create a NEW file.         |
| "I can fix it while I reproduce it" | Fixes without failing tests are blind guesses that miss edge cases.       |
| "I'll group these bugs in one file" | Grouping bugs breaks isolation and makes fixes harder to verify.          |
| "I'll test this related thing too"  | Extraneous tests cause unrelated failures. Test EXACTLY the reported bug. |

**Red Flags - STOP and Start Over**

- Modifying `packages/repro/src/repro-orm.example.test.ts`
- Attempting to fix the issue before the test successfully fails
- Combining multiple problems into a single test file
- Writing assertions for behaviors not explicitly mentioned in the issue
- Saving the test outside `packages/repro/src/`
- Using a generic name instead of `<descriptive-name>[-issue-number].test.ts`

**Any red flag means: Delete the test. Start over.**
