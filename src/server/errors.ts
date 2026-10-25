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
    message = `La page a été modifiée entre-temps (version actuelle : ${currentVersion}). Recharge-la avant de modifier.`,
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

/** Postgres unique violation (23505), whether raw or wrapped by Drizzle in `cause`. */
export function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (typeof x === "object" && x !== null && "code" in x ? (x as { code: unknown }).code : undefined);
  return code(e) === "23505" || code((e as { cause?: unknown })?.cause) === "23505";
}
