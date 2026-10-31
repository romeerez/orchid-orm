<!--
Using AI is fine. However, getting a patch from AI and seeing tests pass does not make it ready for review.
Even small tasks in this codebase often require several rounds of investigation and revision.
Make sure you understand how the solution fits the surrounding code, challenge the AI's assumptions, and address what it missed before opening a PR.
-->

## Summary

<!--
What does this change? Link the related issue if there is one.
For a behavior change, include a usage example and explain the behavior before and after the change.
-->

## Motivation

<!--
How did you run into this?
One or two sentences are enough.
-->

## Verification

<!--
How did you verify this change? Include the checks you ran and their results.
A bug fix needs a regression test: confirm that it fails without the fix and passes with it.
A feature needs tests of its behavior, not a restatement of its implementation.

For significant type changes, report TypeScript instantiation counts before and after, using the same command and configuration (`tsc --extendedDiagnostics`).
-->

## Checklist

- [ ] I have read the final diff and can explain every change.
- [ ] I will address review feedback.
- [ ] I added a changeset (`pnpm changeset`) if this PR includes a feature or bug fix in a published package.
