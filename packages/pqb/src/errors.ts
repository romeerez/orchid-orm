export class NotFoundError extends Error {
  constructor(message = 'Record is not found') {
    super(message);
  }
}
