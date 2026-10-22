const { randomBytes } = require('node:crypto');
const { getSessionTtlMs } = require('../auth/cookieOptions');

const sessions = new Map();

function create(userId, ttlMs = getSessionTtlMs()) {
  const id = randomBytes(32).toString('hex');
  const session = { userId, expiresAt: new Date(Date.now() + ttlMs) };
  sessions.set(id, session);
  return { id, ...session };
}

function get(id) {
  if (typeof id !== 'string') return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return { ...session };
}

function destroy(id) {
  if (typeof id === 'string') sessions.delete(id);
}

module.exports = { create, get, destroy };
