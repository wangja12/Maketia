import { getDb } from "@/db";
import { fileResponseHeaders, redeemDownload } from "@/server/files/files";

/** Buyer download through a grant. Invalid, expired, revoked and used-up links all get 404. */
export async function GET(_request: Request, { params }: RouteContext<"/api/telechargement/[token]">) {
  const { token } = await params;
  const result = await redeemDownload(getDb(), token);
  if (!result) {
    return new Response("Lien de téléchargement invalide, expiré ou déjà utilisé le nombre de fois autorisé. Contactez le vendeur.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  }
  return new Response(result.stream, { headers: fileResponseHeaders(result.file) });
}
