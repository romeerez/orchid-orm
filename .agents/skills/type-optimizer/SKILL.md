---
name: type-optimizer
description: Use when need to optimize TypeScript types.
---

# Type Optimizer

## Workflow

Optimize from the code in front of you, not from a fixed checklist.

- Record a baseline with `--extendedDiagnostics`.
- Change one type-level idea at a time.
- Re-run diagnostics after each idea and keep only changes that pass and reduce `Instantiations`.
- Undo neutral or worse changes unless they improve clarity enough for the user to explicitly accept.
- Preserve public API behavior unless the user explicitly allows changing it.
- Prefer type-only edits. Do not change runtime code unless the task explicitly asks for it.

## Adding Wins

When you find a useful optimization, add it to **Past Wins**. Keep the entry general enough for another agent to recognize the same shape in different code. Include:

- `helps`: one of `tiny bit`, `slightly`, `notably`, `a lot`, `saves the day`
- `when`: the code situation where it applies
- `how`: the concise transformation
- `good`: short code showing the optimized shape
- `bad`: short code showing the costly shape

Do not treat **Past Wins** as the only things to try. They are prior evidence, not a search boundary. Use them when they fit, then keep looking for optimizations specific to the current code.

## Past Wins

### Return Final Shapes Directly

- `helps`: notably
- `when`: helper APIs produce temporary wrapper types that are immediately resolved by nested conditional types with several `infer`s
- `how`: make the helper return the final internal shape directly, and reduce the resolver to a simple return-type extraction
- `good`:

```ts
interface Relation<Id extends string, Columns extends string[]> {
  type: 'hasOne';
  id: Id;
  options: { columns: Columns };
}

type Resolve<T> = T extends (...args: never[]) => infer Result ? Result : T;
```

- `bad`:

```ts
interface Relation<Target, Columns extends string[]> {
  rel: Target;
  columns: Columns;
}

type ResolveOne<T> =
  T extends Relation<infer Target, infer Columns>
    ? Target extends Endpoint<infer Id>
      ? { type: 'hasOne'; id: Id; options: { columns: Columns } }
      : never
    : T;
```

### Name Repeated Indexed Access

- `helps`: notably
- `when`: a mapped type repeatedly reads `Obj[K]` inside nested relation or field conditionals
- `how`: add a helper type with a default generic like `Value = Obj[K]`, then branch on `Value`
- `good`:

```ts
type FieldInfo<Obj, K extends keyof Obj, Value = Obj[K]> = Value extends One
  ? OneInfo<Value>
  : Value extends Many
    ? ManyInfo<Value>
    : never;

type Infos<Obj> = { [K in keyof Obj]: FieldInfo<Obj, K> };
```

- `bad`:

```ts
type Infos<Obj> = {
  [K in keyof Obj]: Obj[K] extends One
    ? OneInfo<Obj[K]>
    : Obj[K] extends Many
      ? ManyInfo<Obj[K]>
      : never;
};
```

### Avoid Union-To-Intersection For Optional Fields

- `helps`: notably
- `when`: optional object fields are built as a union of one-property objects and converted to an intersection via function-parameter inference
- `how`: map the optional fields directly when an intersection is not semantically required
- `good`:

```ts
type OptionalFields<Keys extends string> = [Keys] extends [never]
  ? EmptyObject
  : { [K in Keys]?: FieldValue<K> };
```

- `bad`:

```ts
type OptionalFields<Keys extends string> = {
  [K in Keys]: (value: { [P in K]?: FieldValue<P> }) => void;
}[Keys] extends (value: infer Obj) => void
  ? Obj
  : EmptyObject;
```

### Remap Keys In One Pass

- `helps`: slightly
- `when`: one mapped type computes a union of keys, and another mapped type re-scans the source for each computed key
- `how`: use key remapping to group by the derived key in a single mapped type; if same-key values must stay distinct, force distribution per original key
- `good`:

```ts
type Grouped<Obj> = {
  [K in keyof Obj as Obj[K] extends Item
    ? Obj[K]['group']
    : never]: K extends keyof Obj ? ValueFor<Obj[K]> : never;
};
```

- `bad`:

```ts
type Groups<Obj> = {
  [K in keyof Obj]: Obj[K] extends Item ? Obj[K]['group'] : never;
}[keyof Obj];

type Grouped<Obj> = {
  [Group in Groups<Obj>]: {
    [K in keyof Obj]: Group extends Obj[K]['group'] ? ValueFor<Obj[K]> : never;
  }[keyof Obj];
};
```

### Inline Extracted Method Parameters

- `helps`: tiny bit
- `when`: a public method forwards parameters by extracting `Parameters<GenericMethods<T>['method']>`
- `how`: spell out the equivalent parameter list locally so TypeScript does not instantiate and decompose the whole method interface
- `good`:

```ts
interface Builder<Key extends PropertyKey> {
  index(columns: (Key | IndexOptions<Key>)[], options?: Options): this;
}
```

- `bad`:

```ts
interface Builder<Key extends PropertyKey> {
  index(...args: Parameters<TableMethods<Key>['index']>): this;
}
```

### Remove Cosmetic Simplification From Inputs

- `helps`: tiny bit
- `when`: an input parameter uses a mapped simplifier only to prettify display output
- `how`: accept the underlying object type directly when assignability and public behavior stay the same
- `good`:

```ts
where(input: InputPartial<Shape>): this;
```

- `bad`:

```ts
where(input: Simplify<InputPartial<Shape>>): this;
```

### Avoid Redundant Intersections

- `helps`: tiny bit
- `when`: a type is intersected with a broad constraint or base function type only to satisfy an internal bound
- `how`: keep the precise type when already constrained elsewhere, or use a conditional that returns the precise type only when it satisfies the bound
- `good`:

```ts
type Computed<T> = T extends ComputedFactory ? T : undefined;
type Scopes<T> = T extends undefined ? undefined : T;
```

- `bad`:

```ts
type Computed<T> = T extends undefined ? undefined : ComputedFactory & T;
type Scopes<T> = T & Record<string, unknown>;
```

### Drop Unused Generic Parameters

- `helps`: tiny bit
- `when`: a helper type carries a generic parameter that no longer appears in its implementation
- `how`: remove the unused parameter and update call sites
- `good`:

```ts
type Resolve<T> = T extends (...args: never[]) => infer Result ? Result : T;
```

- `bad`:

```ts
type Resolve<_Context, T> = T extends (...args: never[]) => infer Result
  ? Result
  : T;
```

### Infer Only Needed Structure

- `helps`: tiny bit
- `when`: a callback result was already validated earlier, but another helper re-infers the full object shape to read only one or two fields
- `how`: introduce a smaller structural interface for the later helper
- `good`:

```ts
interface TargetRef<Id extends string, Keys extends string[]> {
  id: Id;
  keys: Keys;
}

use<Id extends string, Keys extends string[]>(fn: () => TargetRef<Id, Keys>): Ref<Id, Keys>;
```

- `bad`:

```ts
use<
  Id extends string,
  Shape extends Record<string, unknown>,
  Keys extends (keyof Shape & string)[],
>(fn: () => FullEndpoint<Id, Shape, Keys>): Ref<Id, Keys>;
```
