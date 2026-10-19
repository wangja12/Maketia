import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/server/admin";
import { NotFoundError } from "@/server/errors";

/** Signed-in platform admin; 404 for everyone else (the area is not advertised). */
export const loadAdmin = cache(async () => {
  const user = await requireUser();
  try {
    await requirePlatformAdmin(getDb(), user.id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return user;
});
