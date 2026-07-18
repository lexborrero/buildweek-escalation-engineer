import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from "../lib/auth";

test("normalizes account email addresses", () => {
  assert.equal(normalizeEmail("  Alex@Example.COM "), "alex@example.com");
});

test("validates sign-up fields", () => {
  assert.deepEqual(
    validateCredentials(
      { name: "A", email: "invalid", password: "short" },
      true,
    ),
    {
      name: "Enter your full name.",
      email: "Enter a valid email address.",
      password: "Use 8–128 characters.",
    },
  );
  assert.deepEqual(
    validateCredentials(
      {
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "correct horse battery staple",
      },
      true,
    ),
    {},
  );
});

test("hashes and verifies passwords without storing the password", async () => {
  const stored = await hashPassword("a secure password", undefined, 1_000);
  assert.notEqual(stored.hash, "a secure password");
  assert.equal(
    await verifyPassword(
      "a secure password",
      stored.hash,
      stored.salt,
      stored.iterations,
    ),
    true,
  );
  assert.equal(
    await verifyPassword(
      "the wrong password",
      stored.hash,
      stored.salt,
      stored.iterations,
    ),
    false,
  );
});
