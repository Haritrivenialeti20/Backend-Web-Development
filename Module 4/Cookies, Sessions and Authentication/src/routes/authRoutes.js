const express = require('express');
const bcrypt = require('bcryptjs');
const userRepository = require('../db/userRepository');
const sessionStore = require('../session/sessionStore');
const requireSession = require('../middleware/requireSession');
const { cookieOptions } = require('../auth/cookieOptions');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function invalidCredentials(res) {
  return res.status(401).json({
    error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
  });
}

router.post('/login', async (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;

  if (!EMAIL_PATTERN.test(email) || typeof password !== 'string' || password.length === 0 || password.length > 1024) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'A valid email and password are required' },
    });
  }

  try {
    const user = await userRepository.findByEmail(email);
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) return invalidCredentials(res);

    const session = sessionStore.create(user.id);
    res.cookie('sid', session.id, cookieOptions());
    return res.status(200).json({ data: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireSession, (req, res) => {
  return res.status(200).json({ data: publicUser(req.user) });
});

router.post('/logout', (req, res) => {
  const sessionId = req.signedCookies && req.signedCookies.sid;
  if (typeof sessionId === 'string') sessionStore.destroy(sessionId);
  res.clearCookie('sid', cookieOptions({ clearing: true }));
  return res.status(204).send();
});

module.exports = router;
