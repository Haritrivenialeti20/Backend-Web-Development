'use strict';

const rateLimit = require('express-rate-limit');

// In a multi-instance deployment, use rate-limit-redis with a shared Redis
// client as the limiter's `store` option. The default in-memory store keeps a
// separate counter on each instance; behind a load balancer a client spread
// across N instances can therefore receive roughly N times the intended limit.
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const resetTime = req.rateLimit && req.rateLimit.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 15 * 60;

    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts. Please try again later.',
      },
    });
  },
});
