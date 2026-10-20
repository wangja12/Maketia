import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isDomainError } from "@/server/errors";
import { fileResponseHeaders, openFileForMember } from "@/server/files/files";

/** A workspace member downloads a product file (to check what buyers receive). */
export async function GET(_request: Request, { params }: RouteContext<"/api/files/[fileId]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const { fileId } = await params;
  try {
    const { file, stream } = await openFileForMember(getDb(), user.id, fileId);
    return new Response(stream, { headers: fileResponseHeaders(file) });
  } catch (e) {
    if (isDomainError(e)) return new Response("Fichier introuvable", { status: 404 });
    throw e;
  }
}
