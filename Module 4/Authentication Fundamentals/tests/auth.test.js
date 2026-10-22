require('dotenv').config();
const assert = require('node:assert/strict');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/db/prisma');

test('registration and login enforce the authentication contract', async () => {
  const email = `auth-fundamentals-${Date.now()}@example.test`;
  const name = '  Test Learner  ';
  const password = 'Fundamentals test password!';
  const server = app.listen(0);

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const postJson = (path, body) => fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const invalid = await postJson('/auth/register', { name: ' ', email, password });
    assert.equal(invalid.status, 400);

    const malformed = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);

    const registration = await postJson('/auth/register', {
      name,
      email: `  ${email.toUpperCase()}  `,
      password,
    });
    assert.equal(registration.status, 201);
    const registrationBody = await registration.json();
    assert.deepEqual(Object.keys(registrationBody.data).sort(), ['email', 'id', 'name']);
    assert.deepEqual(registrationBody.data, {
      id: registrationBody.data.id,
      name: 'Test Learner',
      email,
    });
    assert.ok(!JSON.stringify(registrationBody).includes(password));

    const storedUser = await prisma.user.findUnique({ where: { email } });
    assert.ok(storedUser);
    assert.notEqual(storedUser.passwordHash, password);
    assert.match(storedUser.passwordHash, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(password, storedUser.passwordHash), true);

    const duplicate = await postJson('/auth/register', {
      name: 'Another Learner',
      email: email.toUpperCase(),
      password,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(await prisma.user.count({ where: { email } }), 1);

    const login = await postJson('/auth/login', {
      email: email.toUpperCase(),
      password,
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.deepEqual(loginBody.data, registrationBody.data);
    assert.ok(!JSON.stringify(loginBody).includes(password));
    assert.ok(!JSON.stringify(loginBody).includes(storedUser.passwordHash));

    const badPassword = await postJson('/auth/login', { email, password: 'incorrect' });
    const unknownEmail = await postJson('/auth/login', {
      email: 'unknown-auth-fundamentals@example.test',
      password: 'incorrect',
    });
    assert.equal(badPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    const badPasswordBody = await badPassword.text();
    const unknownEmailBody = await unknownEmail.text();
    assert.equal(badPasswordBody, unknownEmailBody);
    assert.equal(badPasswordBody, JSON.stringify({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    }));
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
