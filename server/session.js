import crypto from 'node:crypto';

// Server-side sessions: the browser only ever receives an opaque random id.
// Salesforce access/refresh tokens never reach the client.
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function createSession(data) {
  const id = randomToken();
  sessions.set(id, { data, expires: Date.now() + SESSION_TTL_MS });
  return id;
}

export function getSession(id) {
  if (typeof id !== 'string') return null;
  const entry = sessions.get(id);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return entry.data;
}

export const destroySession = (id) => sessions.delete(id);

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) if (entry.expires < now) sessions.delete(id);
}, 10 * 60 * 1000).unref();
