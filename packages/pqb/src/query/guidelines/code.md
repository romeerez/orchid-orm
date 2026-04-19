Apply these rules only to code inside `packages/pqb/src/query/`.

Treat every rule in this file as mandatory for every change in that directory.

- `never`, `do not`, `must`, and the ordered checks below are hard stops.
- There are no exceptions for private, internal, helper-only, temporary, or one-file-local code.
- Before creating a new query file or typing `class ... extends ...Error`, stop and re-check the relevant section below.

## Use feature folders for capabilities

When a task explicitly mentions a capability, treat that as a mandatory checkpoint to decide whether the change belongs in a feature folder.

Complete the following check in order before creating a new non-test code file for that capability. Do not skip ahead to step 3.

Follow this order:

1. Check whether a matching or very similar feature folder already exists. If it does, use that folder.
2. If there is no suitable feature folder, but there is already a relevant file that should be changed for the task, update that file directly and do not create a new feature folder.
3. Otherwise, create a new feature folder in one of these locations:

- `basic-features/`: avoid adding new features here. It already covers most basic features.
- `extra-features/`: for public features that users can use directly.
- `internal-features/`: for internal capabilities that are used by other features.

Not all query code is organized into feature folders. Do not force that structure when an existing non-folder file is already the right place for the change.

## New error classes

Never define a new error class anywhere except `packages/pqb/src/query/errors.ts`.

`Never` here is literal: hard stop. There are no exceptions for private, internal, helper-only, or one-file-local error classes.

Mental checkpoint: if you start typing `class ... extends ...Error` anywhere except `packages/pqb/src/query/errors.ts`, stop immediately and move that class to `packages/pqb/src/query/errors.ts`.

Every new error class must live in `packages/pqb/src/query/errors.ts`, even when only one file uses it.

Do not define inline error classes in feature folders, adapters, helpers, builders, or any other query file.

Every new error class must be defined in `packages/pqb/src/query/errors.ts` and must extend one of these base classes:

- `OrchidOrmError`: for errors that are expected to happen sometimes in normal usage. `NotFoundError` is the current example because records are sometimes not found.
- `OrchidOrmInternalError`: for bugs or invalid states, such as invalid input or an unexpected query result. For example, if code expects to update exactly one record but multiple records are affected, that indicates a bug in user code logic.

If unsure which base class fits, stop guessing and default to `OrchidOrmInternalError`.

## Reuse interfaces

When writing inline interface more than once, define it once and reuse.
Do not define if such an interface already exists - reuse the existing one.

Bad:

```ts
function foo(params: { foo: number; prop: { foo: number; bar: string } }) {}

function bar(params: { bar: string; prop: { foo: number; bar: string } }) {}
```

Good:

```ts
interface DescriptiveName {
  foo: number;
  bar: string;
}

function foo(params: { foo: number; prop: DescriptiveName }) {}

function bar(params: { bar: string; prop: DescriptiveName }) {}
```
