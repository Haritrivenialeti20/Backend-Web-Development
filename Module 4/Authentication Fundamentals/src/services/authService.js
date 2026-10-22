const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = Number(process.env.BCRYPT_COST || 12);
if (!Number.isInteger(BCRYPT_COST) || BCRYPT_COST < 4 || BCRYPT_COST > 15) {
  throw new Error('BCRYPT_COST must be an integer from 4 to 15');
}

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class EmailAlreadyExistsError extends AuthError {
  constructor() {
    super(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }
}

class InvalidCredentialsError extends AuthError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
}

function invalidRequest() {
  return new AuthError(400, 'INVALID_REQUEST', 'Valid name, email, and password are required');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function validateEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

function validatePassword(password) {
  return typeof password === 'string'
    && password.length > 0
    && Buffer.byteLength(password, 'utf8') <= 72;
}

// A real bcrypt hash at the same work factor keeps unknown-email login attempts
// from skipping the expensive password comparison. The random source password
// is ephemeral and is never stored or logged.
const dummyHashPromise = bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_COST);

async function register(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const rawEmail = typeof input?.email === 'string' ? input.email : '';
  const password = input?.password;
  const email = normalizeEmail(rawEmail);

  if (!name || name.length > 100 || !validateEmail(email) || !validatePassword(password)) {
    throw invalidRequest();
  }

  if (await userRepository.findByEmail(email)) throw new EmailAlreadyExistsError();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await userRepository.create({ name, email, passwordHash });
    return safeUser(user);
  } catch (error) {
    if (error instanceof userRepository.EmailAlreadyExistsError) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }
}

async function login(input) {
  const rawEmail = typeof input?.email === 'string' ? input.email : '';
  const password = input?.password;
  const email = normalizeEmail(rawEmail);

  if (!validateEmail(email) || !validatePassword(password)) throw invalidRequest();

  const user = await userRepository.findByEmail(email);
  const hash = user ? user.passwordHash : await dummyHashPromise;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !passwordMatches) throw new InvalidCredentialsError();
  return safeUser(user);
}

module.exports = { register, login, AuthError };
