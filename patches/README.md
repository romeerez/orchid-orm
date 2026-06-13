# Patches

This directory contains pnpm patches for third-party packages.

## `jest-runtime@30.4.2.patch`

`pnpm pqb bun:check bun.test` runs Jest under Bun. Jest 30 copies static properties from Node's `Module` class with direct assignment:

```js
Module[key] = value;
```

In Bun, `node:module`.Module exposes `prototype` as an enumerable property. The subclass already has a readonly own `prototype`, so the assignment throws:

```text
TypeError: Attempted to assign to readonly property.
```

The patch changes the copy loop to define properties by descriptor. Existing own descriptors on the subclass are preserved, and missing properties are added with writable/enumerable/configurable descriptors.

## `jest-message-util@30.4.1.patch`

`ADAPTER=bun pnpm pqb bun:check string.test` can fail with an assertion error whose useful message is present on `error.message`, but missing from Bun's `error.stack`.

Jest formats test failures from `error.stack` first. In Node, assertion error stacks usually start with the assertion message, so this works. In Bun, the stack for this failure starts with a frame instead:

```text
@/home/romeo/dev/my/orchid-orm/packages/pqb/src/columns/column-types/string.test.ts:84:36
processTicksAndRejections@
```

Jest's stack parser treats the first line as the message and never falls back to `error.message`, so the report loses the important assertion details and prints only the frame.

The patch changes `jest-message-util` to compare the parsed stack message with `error.message`. When the parsed message does not contain the real error message, the parsed line is moved back into the stack and `error.message` is used as the displayed message.

This restores output such as:

```text
expect(received).toBe(expected) // Object.is equality

Expected: "\\x74657874"
Received: {"data": [116, 101, 120, 116], "type": "Buffer"}
```

The patch is registered in the root `package.json` under `pnpm.patchedDependencies`, and the resolved patch hash is recorded in `pnpm-lock.yaml`.

## `jest-util@30.4.1.patch`

`pnpm pqb bun:check bun.test` runs Jest under Bun, and Jest protects copied global objects by recursively reading their properties in `protectProperties`.

That recursion reads properties from constructor prototypes such as:

```js
Reflect.get(ReadableStreamBYOBReader.prototype, 'closed');
```

Bun's stream reader and writer prototypes have brand-checked accessors. Those accessors can only be read from real instances, not from the prototype object itself. Reading them during Jest's global cleanup setup reports errors such as:

```text
TypeError: The ReadableStreamBYOBReader.closed getter can only be used on instances of ReadableStreamBYOBReader
```

Jest already catches the thrown accessor read, but Bun still prints the error from these brand-checked native getters. The patch makes `protectProperties` inspect the property descriptor before reading a property. If the property is an accessor, Jest skips recursive protection for that property instead of invoking the getter.

This keeps Jest's global cleanup protection for data properties while avoiding side effects from native getters that require a specific receiver.

## `jest-circus@30.4.2.patch`

After the stream accessor issue is avoided, the same Bun test can still fail inside Jest's test timeout handling:

```text
TypeError: undefined is not an object (evaluating 'timeoutID.unref')
```

In this runtime combination, `jest-circus` can run with timer globals that are missing or do not return the Node-style timeout handle Jest expects. The unpatched code captures `setTimeout` and `clearTimeout` from `globalThis`, schedules an internal test timeout, and then always calls:

```js
timeoutID.unref?.();
```

When the timer binding is unavailable or no timeout handle was created, that cleanup path throws instead of finishing the test.

The patch falls back to `node:timers` when `globalThis.setTimeout` or `globalThis.clearTimeout` is missing, and changes the cleanup call to:

```js
timeoutID?.unref?.();
```

This gives Jest a stable timer implementation for its own internal timeout bookkeeping and avoids dereferencing an absent timeout handle.
