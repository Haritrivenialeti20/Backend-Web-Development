const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

function getSessionTtlMs() {
  const configured = Number(process.env.SESSION_TTL_MS);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_SESSION_TTL_MS;
}

function cookieOptions({ clearing = false } = {}) {
  const options = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    signed: true,
    path: '/',
  };

  if (!clearing) options.maxAge = getSessionTtlMs();
  return options;
}

module.exports = { cookieOptions, getSessionTtlMs };
