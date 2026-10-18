import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
