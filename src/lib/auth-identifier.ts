/**
 * Email is optional in this app: players may sign up with just a username.
 * We derive a deterministic synthetic address for the auth backend, which
 * always requires an email credential.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "players.poolcasino.app";

export function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

export function syntheticEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Turns a login identifier (email OR username) into an email for auth. */
export function resolveLoginEmail(identifier: string): string {
  const value = identifier.trim();
  return value.includes("@") ? value : syntheticEmail(value);
}
