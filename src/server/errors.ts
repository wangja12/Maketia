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

/** Someone saved a newer version since the caller read the page. Nothing was overwritten. */
export class ConflictError extends Error {
  constructor(
    readonly currentVersion: number,
    message = `La page a été modifiée entre-temps (version actuelle : ${currentVersion}). Rechargez-la avant de modifier.`,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

export function isDomainError(
  e: unknown,
): e is NotFoundError | ForbiddenError | ValidationError | ConflictError {
  return (
    e instanceof NotFoundError ||
    e instanceof ForbiddenError ||
    e instanceof ValidationError ||
    e instanceof ConflictError
  );
}
