import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Architecture rule: the SaaS runs no AI model. AI lives in the user's external MCP client.
 * This scans the server code and dependencies for model-provider SDKs and endpoints.
 */

const ROOT = path.resolve(__dirname, "../..");
const FORBIDDEN_PACKAGES = [
  "openai", "@anthropic-ai/sdk", "@google/generative-ai", "@google/genai", "@mistralai/mistralai",
  "cohere-ai", "ollama", "ai", "@ai-sdk/openai", "@ai-sdk/anthropic", "langchain", "@langchain/core", "replicate", "groq-sdk",
];
const FORBIDDEN_PATTERNS = [
  /api\.openai\.com/i, /api\.anthropic\.com/i, /generativelanguage\.googleapis\.com/i, /api\.mistral\.ai/i,
  /api\.cohere\.(ai|com)/i, /api\.groq\.com/i, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|MISTRAL_API_KEY/,
];

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? sourceFiles(p) : /\.(ts|tsx|js|mjs)$/.test(e.name) ? [p] : [];
    }),
  );
  return files.flat();
}

describe("no embedded AI", () => {
  it("has no model-provider SDK in dependencies", async () => {
    const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => FORBIDDEN_PACKAGES.includes(d))).toEqual([]);
  });

  it("calls no model-provider API from application code", async () => {
    const files = [...(await sourceFiles(path.join(ROOT, "src"))), ...(await sourceFiles(path.join(ROOT, "scripts")))];
    expect(files.length).toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const f of files) {
      const text = await readFile(f, "utf8");
      if (FORBIDDEN_PATTERNS.some((re) => re.test(text))) offenders.push(path.relative(ROOT, f));
      if (FORBIDDEN_PACKAGES.some((p) => new RegExp(`from ["']${p.replace(/[/.]/g, "\\$&")}["']`).test(text))) {
        offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no e-mail marketing module", async () => {
    const files = await sourceFiles(path.join(ROOT, "src"));
    const offenders: string[] = [];
    for (const f of files) {
      const text = await readFile(f, "utf8");
      if (/from ["'](nodemailer|resend|@sendgrid\/mail|mailchimp|@mailchimp\/[\w-]+|postmark|brevo)["']/.test(text)) {
        offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
