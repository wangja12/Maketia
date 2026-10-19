import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { exportContactsCsv } from "@/server/crm/contacts";
import { isDomainError } from "@/server/errors";

/** CSV export of the contacts matching the current filters (owners and admins). */
export async function GET(request: Request, { params }: RouteContext<"/app/[workspaceId]/contacts/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const { workspaceId } = await params;
  const filters = Object.fromEntries(new URL(request.url).searchParams);
  try {
    const { csv } = await exportContactsCsv(getDb(), user.id, workspaceId, filters);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="contacts-${date}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (isDomainError(e)) return new Response(e.message, { status: e.name === "NotFoundError" ? 404 : 403 });
    throw e;
  }
}
