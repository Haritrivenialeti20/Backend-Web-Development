const sessionStore = require('../session/sessionStore');
const userRepository = require('../db/userRepository');

function reject(res) {
  return res.status(401).json({
    error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
  });
}

module.exports = async function requireSession(req, res, next) {
  const sessionId = req.signedCookies && req.signedCookies.sid;
  if (typeof sessionId !== 'string' || sessionId.length === 0) return reject(res);

  try {
    const session = sessionStore.get(sessionId);
    if (!session) return reject(res);

    const user = await userRepository.findPublicById(session.userId);
    if (!user) {
      sessionStore.destroy(sessionId);
      return reject(res);
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
