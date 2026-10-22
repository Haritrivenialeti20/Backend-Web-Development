require('dotenv').config();
const assert = require('node:assert/strict');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/db/prisma');

test('session authentication lifecycle enforces cookie and server-side session checks', async () => {
  const password = 'SessionTest!48';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: 'session-test@example.com' },
    update: { name: 'Session Test', passwordHash },
    create: { name: 'Session Test', email: 'session-test@example.com', passwordHash },
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' SESSION-TEST@EXAMPLE.COM ', password }),
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), {
      data: { id: user.id, name: 'Session Test', email: 'session-test@example.com' },
    });

    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie && /(?:^|;\s*)HttpOnly/i.test(setCookie));
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /Max-Age=/i);
    assert.ok(!setCookie.includes(passwordHash));
    assert.ok(!setCookie.includes('session-test@example.com'));
    const cookie = setCookie.split(';', 1)[0];

    const me = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), {
      data: { id: user.id, name: 'Session Test', email: 'session-test@example.com' },
    });

    const missingCookie = await fetch(`${baseUrl}/auth/me`);
    assert.equal(missingCookie.status, 401);
    assert.deepEqual((await missingCookie.json()).error, {
      code: 'AUTH_REQUIRED', message: 'Authentication required',
    });

    const cookieParts = cookie.split('=');
    const tamperedCookie = `${cookieParts[0]}=${cookieParts.slice(1).join('=')}tampered`;
    const tampered = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: tamperedCookie } });
    assert.equal(tampered.status, 401);
    assert.deepEqual((await tampered.json()).error, {
      code: 'AUTH_REQUIRED', message: 'Authentication required',
    });

    const badPassword = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'session-test@example.com', password: 'wrong' }),
    });
    const unknownEmail = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com', password: 'wrong' }),
    });
    assert.equal(badPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(await badPassword.json(), await unknownEmail.json());

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST', headers: { cookie },
    });
    assert.equal(logout.status, 204);
    const clearCookie = logout.headers.get('set-cookie');
    assert.ok(clearCookie && /(?:^|;\s*)HttpOnly/i.test(clearCookie));
    assert.match(clearCookie, /SameSite=Lax/i);
    assert.match(clearCookie, /Path=\//i);

    const replay = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    assert.equal(replay.status, 401);

    const repeatedLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST', headers: { cookie },
    });
    assert.equal(repeatedLogout.status, 204);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
