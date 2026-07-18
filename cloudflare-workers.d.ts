declare module "cloudflare:workers" {
  export const env: {
    DB: import("@/db/types").D1Database;
  };
}
