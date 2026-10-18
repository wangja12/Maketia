// Domain errors. Server actions translate them into user-facing messages;
// anything else is an unexpected failure and is logged, not shown.

export class NotFoundError extends Error {
  constructor(message = "Ressource introuvable") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isDomainError(
  e: unknown,
): e is NotFoundError | ForbiddenError | ValidationError {
  return (
    e instanceof NotFoundError ||
    e instanceof ForbiddenError ||
    e instanceof ValidationError
  );
}
