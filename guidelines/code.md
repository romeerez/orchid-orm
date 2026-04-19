## read before editing

- Read this file and every applicable nested `guidelines/code.md` before changing code.
- Treat every rule below as **MANDATORY**. `always`, `never`, `do not`, `only`, and `must` are **HARD STOPS**.
- There are no exceptions for private, internal, local, temporary, or "small" code unless a rule explicitly says so.
- Nested guidelines are not optional add-ons. If a nested guideline applies, follow both this file and the nested file together.
- When a rule says code belongs in one place or must use one shape, stop and move the code there instead of rationalizing an exception.
- `prefer` still means the default. Only diverge when there is a concrete local reason, and first check whether a nested guideline already made the decision for you.
- Before adding a test, interface, import pattern, class, or new file, re-check the relevant sections below.

## always write tests first

Always write a test before writing code.

### tests scope

The preferred structure is feature folders, though not every part of the codebase follows this yet.
A feature folder can contain one or more code files with the same base name and different suffixes, such as `foo.qb.ts` and `foo.sql.ts`.
Those suffixed files are parts of one feature.

Do not write separate tests for the suffixed files.
Test the feature as a whole instead, for example with `foo.test.ts` inside the `foo/` feature folder.

Only write a test for a specific file when that file is not part of a feature folder.

Before writing the test, understand the requirement or edge case from the broader feature perspective.
Write the test for that requirement first, then make the relevant changes in the specific file or files.

### test/code flow

- When adding a test to an existing test file, follow the style and approach already used there.
- When creating a new test file, look at how nearby similar features are tested.
- Start with a minimal test that covers the simplest positive case. You do not need to run it before changing code.
- Write the minimal amount of code needed to support that test.
- Run the test with `pnpm --filter <pkg> check --silent path/to/file.test.ts`, where `<pkg>` is the package folder name such as `pqb`, `orm`, or `rake-db`. For `schemaConfigs` packages, use `valibot` or `zod`.
- If the test fails, keep fixing the code until it passes.
- For a simple change, once the code is ready, confirm that either one test is enough to cover the requirement or add enough tests to cover it properly.
- For a medium change, write several tests in one pass, then implement support for them in one pass, and repeat until the requirements are covered.
- For a complex change, work one test at a time: write a single test, implement support for it, and repeat until the requirements are covered.
- Once the new tests and code changes for the task are complete, run all affected tests in the package with `pnpm --filter <pkg> check --silent -o` and fix any failures.
- Then run the same command for every public package that depends on the changed package. Only test `test-factory`, `zod`, and `valibot` when you changed something inside `pqb/src/columns/`.
- When testing dependent packages, only run public packages: `orm`, `pqb`, `rake-db`, `test-factory`, `zod`, and `valibot`. Ignore the rest.

### assert the complete relevant result

When a test knows the expected returned value, assert that value directly.

Do not assert a result property by property when the test is really verifying the whole returned object or array.

`expect(result).toBeDefined()` is not an acceptable assertion when the test knows what the result should be.

Use `toEqual` only when it confirms the behavior the test is about.

If the test is about the full response, assert the full response.
If the test is about one specific part of the response, assert only that relevant part.

Do not add assertions for unrelated properties just to make the test look more complete.

Bad when the test is about the full result:

```ts
expect(result).toBeDefined();
expect(result.foo).toBe('some value');
```

Good when the test is about the full result:

```ts
expect(result).toEqual({
  foo: 'some value',
});
```

Good when the test is about one specific field:

```ts
expect(result[0].updatedAt).toBeInstanceOf(Date);
```

### test TypeScript interfaces

Only use type assertions in runtime tests when the function under test returns a TypeScript mapping, meaning it is generic and the result type depends on its arguments.
In that case, use `assertType` to verify the resulting type.

Do not create extra tests whose only purpose is to check types.
Add `assertType` to existing tests that already verify runtime expectations.

Example:

```ts
import { assertType, UserRecord } from 'test-utils';

it('should return an array of user records', async () => {
  const res = await db.user.all();

  assertType<typeof res, UserRecord[]>();
});
```

The first generic argument is the actual type.
The second generic argument is the expected type.

## TypeScript interfaces

### avoid native TS type utilities

MUST USE:

- `RecordStringOrNumber` from pqb instead of `Record<string, string | number>`
- `RecordString` from pqb instead of `Record<string, string>`
- `RecordKeyTrue` from pqb instead of `Record<string, true>`
- `RecordOptionalString` from pqb instead of `Record<string, string | undefined>`
- `RecordUnknown` from pqb instead of `Record<string, unknown>`
- `RecordBoolean` from pqb instead of `Record<string, boolean>`

### avoid nesting interfaces without a good reason

For internal interfaces only, avoid nesting unless there is a clear reason.
If the new properties represent a distinct capability, prefer a separate interface and `extends`.
If they do not, inline the properties directly into the existing interface.

Bad:

```ts
// this is existing interface
interface AsyncState {
  // existing property
  foo?: boolean;
  // adding a new property
  asyncRoleState: AsyncRoleState;
}

// a new interface
interface AsyncRoleState {
  role?: string;
}
```

Good when the new properties belong to a distinct capability, such as a separate feature folder or file:

```ts
// this is existing interface
interface AsyncState extends AsyncRoleState {
  // existing property
  foo?: boolean;
}

// a new interface
interface AsyncRoleState {
  role?: string;
}
```

Good when the new properties simply extend the existing interface and do not need their own nested object:

```ts
// this is existing interface
interface AsyncState {
  // existing property
  foo?: boolean;
  // new property
  role?: string;
}
```

### add comments to properties

For private interfaces, add short descriptive comments above properties.

For public interfaces, use human-oriented JSDoc comments.
Do not describe argument types or return types in JSDoc when TypeScript already expresses them.

### don't export interfaces without need

Do not export an interface if it is only used in the current file.

Export it only when another file needs to use it.

## imports

Inside a package, use full relative imports for other files in the same package.
Do not import from `index.ts`, `public.ts`, or `internal.ts` from within that same package.

This helps prevent circular dependency issues.

## loops

When iterating over object keys, use `for (const key in obj)`.

When reading `obj[key]` inside that loop, TypeScript may complain:

- Do not add `obj[key as keyof typeof obj]` unless TypeScript actually requires it.
- If TypeScript does complain and the key is obviously correct, add an appropriate `as` cast.

When mapping an object to another object and the loop body is a single line, prefer `Object.fromEntries` with `Object.entries(...).map(...)`:

```ts
Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [key, map(value)]),
);
```

## do not write redundant undefined and null checks when they add nothing

When a variable can only be truthy or `undefined`:

- If you specifically need a boolean, use `!!foo` or `!foo`.
- Otherwise, inline the value directly in the condition, for example `if (foo)`.

Prefer the shorter form when it is functionally equivalent.

## prefer params?.foo over nested if

Bad:

```ts
if (params) {
  if (params.foo) someCode;
  if (params.bar) someCode;
}
```

Good:

```ts
if (params?.foo) someCode;
if (params?.bar) someCode;
```

## do not pass new objects when you can pass existing object

If the type matches, even if the object has other properties, pass the existing object rather than passing an explicit newly constructed object.

Bad:

```ts
fn(obj?.foo ? { foo: obj.foo } : undefined);
```

Good:

```ts
fn(obj?.foo ? obj : undefined);
```

## prefer destructuring over simple `const foo = obj.foo`

Good:

```ts
const { foo } = obj;
```

## only necessary code comments

Comments must only explain what's not obvious from the code.
