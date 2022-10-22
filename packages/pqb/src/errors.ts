export class PormError extends Error {}

export class NotFoundError extends PormError {
  constructor(message = 'Record is not found') {
    super(message);
  }
}

export class MoreThanOneRowError extends PormError {}

export class PormInternalError extends Error {}

export class UnhandledTypeError extends PormInternalError {
  constructor(value: never) {
    super(`Unhandled type: ${JSON.stringify(value)} received`);
  }
}
