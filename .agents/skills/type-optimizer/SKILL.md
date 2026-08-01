---
name: type-optimizer
description: Use when need to optimize TypeScript types.
---

# Type Optimizer

## Workflow

Optimize from the code in front of you. Start with proven ideas from `type-optim.md`, but treat each one as a candidate that must fit the current code.

- Record a baseline with `--extendedDiagnostics`.
- Run `node .agents/skills/type-optimizer/top-type-optims.js` to get the optimization list sorted by historical mean `Instantiations` savings.
- Read `.agents/skills/type-optimizer/type-optim.md`.
- Try one optimization at a time in the sorted order.
- Skip an optimization when the current code does not have the matching shape.
- Re-run `types --extendedDiagnostics` after each idea.
- Submit every measured attempt immediately with `node .agents/skills/type-optimizer/update-type-optim-stats.js <optimization-number> <instantiations-diff>`.
- Use `previous Instantiations - new Instantiations` for `<instantiations-diff>`: positive means the attempt improved, negative means it regressed.
- Keep only changes that pass and reduce `Instantiations`.
- After submitting a negative diff, revert that attempted change before trying the next idea.
- Undo neutral or worse changes unless they improve clarity enough for the user to explicitly accept.
- Preserve public API behavior unless the user explicitly allows changing it.
- Prefer type-only edits. Do not change runtime code unless the task explicitly asks for it.

The saved list is not a blind checklist: while trying it, judge every candidate against the code in front of you. After the list ends, stop using it as guidance and focus solely on the code at hand to find new optimization ideas.

## Optimization Example Style

Examples in `type-optim.md` must be abstract and obvious. They should teach the type-system shape, not the project feature where the idea was first found.

- Use plain names like `Obj`, `Key`, `Value`, `Item`, `Input`, `Output`.
- Avoid domain names like relations, columns, tables, endpoints, scopes, migrations, or validation.
- Keep only the type machinery needed to show why the bad shape costs more and why the good shape is cheaper.
- Put `bad` before `good`, so the reader sees the problem before the transformation.

**bad**:

```ts
interface TargetRef<Id extends string, Keys extends string[]> {
  id: Id;
  keys: Keys;
}

use<
  Id extends string,
  Shape extends Record<string, unknown>,
  Keys extends (keyof Shape & string)[],
>(fn: () => FullEndpoint<Id, Shape, Keys>): Ref<Id, Keys>;
```

**good**:

```ts
interface Needed<A, B> {
  first: A;
  second: B;
}

use<A, B>(fn: () => Needed<A, B>): Output<A, B>;
```

## Adding Optimizations

When the documented list is exhausted, try creative undocumented type optimization attempts. If a new idea reduces `Instantiations` by more than 1000 and passes checks, append it to `type-optim.md`, then call `update-type-optim-stats.js` with the new number and measured diff.

Use this template:

````md
### <next-number>. <Imperative Title>

**stats**: {}

**when**: <code situation where it applies>

**how**: <concise transformation>

**bad**:

```ts
<costly abstract shape>
```

**good**:

```ts
<optimized abstract shape>
```
````
