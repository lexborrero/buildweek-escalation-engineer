export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL
  )
`;

export const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const CREATE_SESSIONS_USER_INDEX = `
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)
`;

export const CREATE_SESSIONS_EXPIRY_INDEX = `
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)
`;
