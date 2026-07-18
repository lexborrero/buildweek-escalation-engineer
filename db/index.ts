import { env } from "cloudflare:workers";
import {
  CREATE_SESSIONS_EXPIRY_INDEX,
  CREATE_SESSIONS_TABLE,
  CREATE_SESSIONS_USER_INDEX,
  CREATE_USERS_TABLE,
} from "./schema";
import type { D1Database } from "./types";

let schemaReady: Promise<void> | null = null;

export function getDb(): D1Database {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set `d1` to `DB` in .openai/hosting.json.",
    );
  }
  return env.DB;
}

export async function ensureAuthSchema(): Promise<D1Database> {
  const db = getDb();
  schemaReady ??= db
    .batch([
      db.prepare(CREATE_USERS_TABLE),
      db.prepare(CREATE_SESSIONS_TABLE),
      db.prepare(CREATE_SESSIONS_USER_INDEX),
      db.prepare(CREATE_SESSIONS_EXPIRY_INDEX),
    ])
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });
  await schemaReady;
  return db;
}
