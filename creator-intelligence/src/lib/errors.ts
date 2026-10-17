/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'bad_request',
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'UserError';
  }
}

export class NotFoundError extends UserError {
  constructor(what = 'Record') {
    super(`${what} not found.`, 404, 'not_found');
  }
}

export class ConflictError extends UserError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'conflict', details);
  }
}
