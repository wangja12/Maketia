import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listWorkspacesForUser } from "@/server/workspaces";

export default async function AppIndex() {
  const user = await requireUser();
  const [first] = await listWorkspacesForUser(getDb(), user.id);
  // Every account gets a workspace at sign-up; none means it was removed.
  if (!first) redirect("/connexion");
  redirect(`/app/${first.id}`);
}
