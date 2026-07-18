import { cookies } from "next/headers";

export const SESSION_COOKIE = "ee_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
// The deployed Workers Web Crypto implementation rejects PBKDF2 counts above
// 100,000, so keep the persisted policy at the platform's supported maximum.
export const PASSWORD_ITERATIONS = 100_000;
const encoder = new TextEncoder();

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type StoredUser = AuthUser & {
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

export type AuthValidation = {
  name?: string;
  email?: string;
  password?: string;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCredentials(
  input: {
    name?: string;
    email?: string;
    password?: string;
  },
  includeName: boolean,
): AuthValidation {
  const errors: AuthValidation = {};
  const name = input.name?.trim() ?? "";
  const email = normalizeEmail(input.email ?? "");
  const password = input.password ?? "";

  if (includeName && (name.length < 2 || name.length > 80)) {
    errors.name = "Enter your full name.";
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < 8 || password.length > 128) {
    errors.password = "Use 8–128 characters.";
  }
  return errors;
}

export async function hashPassword(
  password: string,
  salt = randomToken(16),
  iterations = PASSWORD_ITERATIONS,
): Promise<{ hash: string; salt: string; iterations: number }> {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) {
    throw new RangeError(
      "Password iteration count must be between 1 and 100,000.",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt).buffer as ArrayBuffer,
      iterations,
    },
    key,
    256,
  );
  return { hash: bytesToBase64Url(new Uint8Array(bits)), salt, iterations };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  const candidate = await hashPassword(password, salt, iterations);
  return constantTimeEqual(candidate.hash, storedHash);
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser; sessionToken: string }> {
  const db = await authDb();
  const user: AuthUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
  };
  const password = await hashPassword(input.password);
  const now = Date.now();
  const session = await newSession(user.id, now);

  await db.batch([
    db
      .prepare(
        `INSERT INTO users
          (id, name, email, password_hash, password_salt, password_iterations, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        user.id,
        user.name,
        user.email,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(session.tokenHash, user.id, now, session.expiresAt),
  ]);

  return { user, sessionToken: session.token };
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ user: AuthUser; sessionToken: string } | null> {
  const db = await authDb();
  const stored = await db
    .prepare(
      `SELECT id, name, email, password_hash, password_salt, password_iterations
       FROM users WHERE email = ? LIMIT 1`,
    )
    .bind(normalizeEmail(email))
    .first<StoredUser>();

  if (!stored) {
    await hashPassword(password, randomToken(16), PASSWORD_ITERATIONS);
    return null;
  }
  const valid = await verifyPassword(
    password,
    stored.password_hash,
    stored.password_salt,
    stored.password_iterations,
  );
  if (!valid) return null;

  const now = Date.now();
  const session = await newSession(stored.id, now);
  await db.batch([
    db
      .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
      .bind(now, stored.id),
    db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(session.tokenHash, stored.id, now, session.expiresAt),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
  ]);
  return {
    user: { id: stored.id, name: stored.name, email: stored.email },
    sessionToken: session.token,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySession(token);
}

export async function findUserBySession(
  token: string,
): Promise<AuthUser | null> {
  const db = await authDb();
  const tokenHash = await sha256(token);
  return db
    .prepare(
      `SELECT users.id, users.name, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<AuthUser>();
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await authDb();
  await db
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}

export function sessionCookie(token: string, secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function requestHasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function authDb() {
  const { ensureAuthSchema } = await import("@/db");
  return ensureAuthSchema();
}

async function newSession(userId: string, now: number) {
  const token = randomToken(32);
  return {
    token,
    tokenHash: await sha256(token),
    userId,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
