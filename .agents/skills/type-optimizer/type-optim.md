### 1. Return Final Shapes Directly

**stats**: {
"-50001-100000": 2
}

**when**: a helper creates an intermediate wrapper that another type immediately unwraps and reshapes

**how**: make the helper expose the final shape directly, and keep the resolver to a simple return-type extraction when possible

**bad**:

```ts
interface Wrapper<Target, Values extends unknown[]> {
  target: Target;
  values: Values;
}

interface Named<Name extends string> {
  name: Name;
}

type Resolve<T> =
  T extends Wrapper<infer Target, infer Values>
    ? Target extends Named<infer Name>
      ? { name: Name; values: Values }
      : never
    : T;
```

**good**:

```ts
interface Final<Name extends string, Values extends unknown[]> {
  name: Name;
  values: Values;
}

type Resolve<T> = T extends (...args: never[]) => infer Result ? Result : T;
```

### 2. Name Repeated Indexed Access

**stats**: {
"201-500": 2,
"-20001-50000": 2,
"101-200": 2,
"-0-100": 3,
"-2001-5000": 3,
"-501-1000": 2,
"-200001-500000": 1,
"-100001-200000": 1,
"501-1000": 1,
"-201-500": 1,
"-1001-2000": 2,
"0-100": 1
}

**when**: a mapped type repeatedly reads `Obj[K]` inside nested conditionals

**how**: add a helper type with a default generic like `Value = Obj[K]`, then branch on `Value`

**bad**:

```ts
type Infos<Obj> = {
  [K in keyof Obj]: Obj[K] extends KindA
    ? InfoA<Obj[K]>
    : Obj[K] extends KindB
      ? InfoB<Obj[K]>
      : never;
};
```

**good**:

```ts
type InfoFor<Obj, K extends keyof Obj, Value = Obj[K]> = Value extends KindA
  ? InfoA<Value>
  : Value extends KindB
    ? InfoB<Value>
    : never;

type Infos<Obj> = { [K in keyof Obj]: InfoFor<Obj, K> };
```

### 3. Avoid Union-To-Intersection For Optional Fields

**stats**: {
"-201-500": 1,
"-0-100": 2
}

**when**: optional object fields are built as a union of one-property objects and converted to an intersection via function-parameter inference

**how**: map the optional fields directly when an intersection is not semantically required

**bad**:

```ts
type OptionalProps<Keys extends string> = {
  [K in Keys]: (value: { [P in K]?: ValueFor<P> }) => void;
}[Keys] extends (value: infer Obj) => void
  ? Obj
  : EmptyObject;
```

**good**:

```ts
type OptionalProps<Keys extends string> = [Keys] extends [never]
  ? EmptyObject
  : { [K in Keys]?: ValueFor<K> };
```

### 4. Remap Keys In One Pass

**stats**: {
"-5001-10000": 1,
"-1001-2000": 1
}

**when**: one mapped type computes a union of keys, and another mapped type re-scans the source for each computed key

**how**: use key remapping to group by the derived key in a single mapped type; if same-key values must stay distinct, force distribution per original key

**bad**:

```ts
type Groups<Obj extends Record<string, Item>> = {
  [K in keyof Obj]: Obj[K]['group'];
}[keyof Obj];

type Grouped<Obj extends Record<string, Item>> = {
  [G in Groups<Obj>]: {
    [K in keyof Obj]: G extends Obj[K]['group'] ? Obj[K]['value'] : never;
  }[keyof Obj];
};
```

**good**:

```ts
type Grouped<Obj extends Record<string, Item>> = {
  [K in keyof Obj as Obj[K]['group']]: Obj[K]['value'];
};
```

### 5. Inline Extracted Method Parameters

**stats**: {
"201-500": 1
}

**when**: a method forwards parameters by extracting `Parameters<OtherInterface<T>['method']>`

**how**: spell out the equivalent parameter list locally so TypeScript does not instantiate and decompose the whole method interface

**bad**:

```ts
interface Builder<Value> {
  set(...args: Parameters<OtherMethods<Value>['set']>): this;
}
```

**good**:

```ts
interface Builder<Value> {
  set(input: Value, options?: Options<Value>): this;
}
```

### 6. Remove Cosmetic Simplification From Inputs

**stats**: {
"501-1000": 2
}

**when**: an input parameter uses a mapped simplifier only to prettify display output

**how**: accept the underlying object type directly when assignability and public behavior stay the same

**bad**:

```ts
handle(input: Simplify<InputShape<Data>>): this;
```

**good**:

```ts
handle(input: InputShape<Data>): this;
```

### 7. Avoid Redundant Intersections

**stats**: {}

**when**: a type is intersected with a broad constraint or base function type only to satisfy an internal bound

**how**: keep the precise type when already constrained elsewhere, or use a conditional that returns the precise type only when it satisfies the bound

**bad**:

```ts
interface Base {
  (...args: never[]): unknown;
}

type Keep<T extends Base | undefined> = T extends undefined
  ? undefined
  : Base & T;
type Named<T> = T & Record<string, unknown>;
```

**good**:

```ts
interface Base {
  (...args: never[]): unknown;
}

type Keep<T extends Base | undefined> = T extends Base ? T : undefined;
type Named<T extends Record<string, unknown>> = T;
```

### 8. Drop Unused Generic Parameters

**stats**: {
"0-100": 2,
"-2001-5000": 1
}

**when**: a helper type carries a generic parameter that no longer appears in its implementation

**how**: remove the unused parameter and update call sites

**bad**:

```ts
type Resolve<_Context, T> = T extends (...args: never[]) => infer Result
  ? Result
  : T;
```

**good**:

```ts
type Resolve<T> = T extends (...args: never[]) => infer Result ? Result : T;
```

### 9. Infer Only Needed Structure

**stats**: {
"-501-1000": 1,
"5001-10000": 1,
"-201-500": 1,
"101-200": 1,
"-101-200": 1,
"-0-100": 3,
"-1000001-2000000": 1,
"-2001-5000": 1
}

**when**: an earlier step validates a large result, but a later helper only reads a few fields from it

**how**: introduce a smaller structural interface for the later helper instead of re-inferring the whole result

**bad**:

```ts
interface FullResult<Id, Shape, Keys extends keyof Shape> {
  id: Id;
  shape: Shape;
  keys: Keys[];
  meta: MetaFor<Shape>;
}

use<Id, Shape, Keys extends keyof Shape>(
  fn: () => FullResult<Id, Shape, Keys>,
): Output<Id, Keys>;
```

**good**:

```ts
interface Needed<Id, Keys> {
  id: Id;
  keys: Keys[];
}

use<Id, Keys>(fn: () => Needed<Id, Keys>): Output<Id, Keys>;
```

### 10. Infer From Needed Members Instead Of Full Interface

**stats**: {
"5001-10000": 1,
"-201-500": 3,
"-2001-5000": 2,
"-5001-10000": 1,
"201-500": 2,
"-1001-2000": 1,
"-0-100": 1,
"101-200": 1,
"-101-200": 1,
"0-100": 2
}

**when**: a helper matches a large interface with many generic parameters, but only needs values from a few members

**how**: match a structural object containing only the members needed to infer those values, then rebuild the output from those inferred pieces

**bad**:

```ts
interface Full<A, B, C, D, E> {
  data: Data<A, B, C, D>;
  meta: E;
  make(): Output<A, B, C, D>;
}

type Resolve<T> =
  T extends Full<infer A, infer B, infer C, infer D, infer _E>
    ? Output<A, B, C, D>
    : never;
```

**good**:

```ts
type Resolve<T> = T extends {
  data: {
    first: infer A;
    second: infer B;
    third: infer C;
  };
  make(): {
    item: infer D;
  };
}
  ? Output<A, B, C, D>
  : never;
```
