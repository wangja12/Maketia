import { isDomainError, ValidationError } from "@/server/errors";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a failed form keeps what the user typed. */
  values?: Record<string, string>;
  ok?: boolean;
};

/** Domain errors become messages; anything else is logged and shown generically. */
export function toActionState(e: unknown, values?: Record<string, string>): ActionState {
  if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors, values };
  if (isDomainError(e)) return { error: e.message, values };
  console.error(e);
  return { error: "Une erreur inattendue est survenue. Réessaie dans un instant.", values };
}
