import type { NextConfig } from "next";

/** Same on every response; the per-request Content-Security-Policy is set in proxy.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // HTTPS only, for this host. No includeSubDomains: customers' own domains are served here too.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Argon2 is a native module: keep it out of the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  // The MCP route reads the versioned design skill from disk at runtime.
  outputFileTracingIncludes: { "/api/mcp": ["./skills/wang-design-engineering/**/*"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
