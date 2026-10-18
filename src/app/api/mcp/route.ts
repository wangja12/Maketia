import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getDb } from "@/db";
import { loadDesignSkill } from "@/server/design-skill";
import { buildMcpServer } from "@/server/mcp/server";
import { authenticateMcpToken } from "@/server/mcp-tokens";

// Stateless Streamable HTTP: every POST carries its bearer token and gets a fresh server.
// No session state, so it scales horizontally and a revoked token stops working at once.

function unauthorized(message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="tunnels-ia"' } },
  );
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) return unauthorized("Jeton manquant : en-tête Authorization: Bearer <jeton>.");

  const db = getDb();
  const ctx = await authenticateMcpToken(db, token);
  if (!ctx) return unauthorized("Jeton invalide ou révoqué.");

  const server = buildMcpServer({ db, ctx, loadSkill: loadDesignSkill });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 512 * 1024,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON mode: the response is complete once handleRequest resolves.
    await server.close();
  }
}

// Stateless server: no server-initiated stream and no session to delete.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
