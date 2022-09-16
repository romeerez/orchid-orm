export class NotFoundError extends Error {
  constructor(message = 'Record is not found') {
    super(message);
  }
}

export class MoreThanOneRowError extends Error {}
