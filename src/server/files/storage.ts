import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/*
 * Private file storage. One driver today: the server's local disk, in FILES_DIR (outside any
 * public directory). An S3-compatible driver is not built: no bucket or credentials exist yet.
 * Local disk only suits a host with a persistent disk; on ephemeral hosting files would be lost
 * (the production check warns about it).
 */

export interface FileStorage {
  readonly kind: "local";
  /** Moves a fully written temporary file into place under `key`. */
  commit(tempPath: string, key: string): Promise<void>;
  read(key: string): Promise<ReadableStream<Uint8Array> | null>;
  remove(key: string): Promise<void>;
  tempPath(): Promise<string>;
}

const KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export function filesRoot() {
  // Runtime location of private data, never part of the build output.
  return path.resolve(/*turbopackIgnore: true*/ process.env.FILES_DIR ?? ".data/files");
}

// Plain concatenation (the key is validated): a path.join here makes the build tracer include
// the whole project in the server output.
function resolveKey(key: string) {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  return `${filesRoot()}/${key}`;
}

export const localStorage: FileStorage = {
  kind: "local",
  async tempPath() {
    const dir = `${filesRoot()}/.tmp`;
    await mkdir(dir, { recursive: true });
    return `${dir}/${crypto.randomUUID()}`;
  },
  async commit(tempPath, key) {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(tempPath, target);
  },
  async read(key) {
    const file = resolveKey(key);
    try {
      await stat(file);
    } catch {
      return null;
    }
    return Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  },
  async remove(key) {
    await rm(resolveKey(key), { force: true });
  },
};

export function fileStorage(): FileStorage {
  return localStorage;
}
