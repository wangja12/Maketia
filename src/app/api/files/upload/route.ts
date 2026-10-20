import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { toActionState } from "@/lib/action-state";
import { uploadProductFile } from "@/server/files/files";

/*
 * Upload of a product file, the request body being the file itself (streamed to disk).
 * Excluded from proxy.ts (which would buffer and cut bodies over 10 MB). The custom
 * X-File-Name header makes cross-site form posts impossible (it requires a CORS preflight).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Non connecté" }, { status: 401 });
  const encodedName = request.headers.get("x-file-name");
  if (!encodedName) return Response.json({ error: "En-tête X-File-Name requis" }, { status: 400 });
  const params = new URL(request.url).searchParams;
  try {
    const file = await uploadProductFile(getDb(), user.id, params.get("product") ?? "", {
      fileName: decodeURIComponent(encodedName),
      title: params.get("title") ?? undefined,
      replaceFileId: params.get("replace") ?? undefined,
      body: request.body,
    });
    return Response.json({ id: file.id, title: file.title, version: file.version, sizeBytes: file.sizeBytes }, { status: 201 });
  } catch (e) {
    const state = toActionState(e);
    const status = e instanceof Error && e.name === "NotFoundError" ? 404 : e instanceof Error && e.name === "ForbiddenError" ? 403 : state.error?.startsWith("Une erreur inattendue") ? 500 : 400;
    return Response.json({ error: state.error }, { status });
  }
}
