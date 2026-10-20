import { readFile } from "node:fs/promises";
import path from "node:path";

/** Must match `version` in skills/wang-design-engineering/SKILL.md (checked by tests). */
export const DESIGN_SKILL_VERSION = "1.1.0";
export const DESIGN_SKILL_URI = "wang://skills/design-engineering";

export type DesignSkill = { version: string; text: string };
export type SkillLoader = () => Promise<DesignSkill>;

export class SkillUnavailableError extends Error {
  constructor(cause: unknown) {
    super("La skill wang-design-engineering est introuvable sur le serveur. Les opérations de conception sont suspendues.");
    this.name = "SkillUnavailableError";
    this.cause = cause;
  }
}

export const SKILL_PATH = path.join(process.cwd(), "skills", "wang-design-engineering", "SKILL.md");

export const loadDesignSkill: SkillLoader = async () => {
  let text: string;
  try {
    text = await readFile(SKILL_PATH, "utf8");
  } catch (e) {
    throw new SkillUnavailableError(e);
  }
  const version = /^version:\s*(\S+)/m.exec(text)?.[1];
  if (version !== DESIGN_SKILL_VERSION) {
    throw new SkillUnavailableError(new Error(`version mismatch: file ${version}, code ${DESIGN_SKILL_VERSION}`));
  }
  return { version, text };
};
