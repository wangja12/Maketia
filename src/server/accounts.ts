import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { ValidationError } from "./errors";
import { fieldErrorsOf } from "./validation";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Indiquez votre nom").max(80, "80 caractères maximum"),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  password: z
    .string()
    .min(10, "10 caractères minimum")
    .max(200, "200 caractères maximum"),
});

export type SignUpInput = z.input<typeof signUpSchema>;

// Precomputed so unknown e-mails cost as much as wrong passwords (no timing oracle).
let dummyHash: Promise<string> | undefined;

/** Creates the user and their first workspace, owned by them, in one transaction. */
export async function signUp(db: Db, input: SignUpInput) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  }
  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name, email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!user) {
      throw new ValidationError("Vérifiez les champs", {
        email: "Un compte existe déjà avec cette adresse",
      });
    }
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: `Espace de ${name}` })
      .returning({ id: workspaces.id });
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    return { userId: user.id, workspaceId: workspace.id };
  });
}

/** Returns the user id when the credentials match, otherwise null. */
export async function verifyCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!user) {
    dummyHash ??= hash("timing-equalizer");
    await verify(await dummyHash, password);
    return null;
  }
  return (await verify(user.passwordHash, password)) ? user.id : null;
}
