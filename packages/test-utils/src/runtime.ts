export const isBunRuntime = Boolean(process.versions.bun);

export const describeIfBun: typeof describe = isBunRuntime
  ? describe
  : describe.skip;
