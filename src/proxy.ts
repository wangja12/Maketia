import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no database here. Every page and action re-validates the session.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/preview/:path*"] };
