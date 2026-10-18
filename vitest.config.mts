import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts", "tests/unit/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    // Tests share one database; run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
