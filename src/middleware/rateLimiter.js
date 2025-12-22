const { RateLimiterMemory } = require('rate-limiter-flexible');

// General API rate limiter
const generalLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // 15 minutes
});

// Auth endpoints rate limiter (stricter)
const authLimiter = new RateLimiterMemory({
  points: 10, // 10 attempts
  duration: 60 * 15, // 15 minutes
  blockDuration: 60 * 60, // Block for 1 hour if exceeded
});

// Password reset limiter
const passwordResetLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60 * 24, // Block for 24 hours if exceeded
});

// Purchase limiter
const purchaseLimiter = new RateLimiterMemory({
  points: 20, // 20 purchases
  duration: 60 * 60, // 1 hour
});

// General rate limit middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.user ? req.user._id.toString() : req.ip;
    await generalLimiter.consume(key);
    next();
  } catch (error) {
    if (error.remainingPoints !== undefined) {
      res.set('Retry-After', Math.ceil(error.msBeforeNext / 1000));
      res.set('X-RateLimit-Limit', generalLimiter.points);
      res.set('X-RateLimit-Remaining', error.remainingPoints);
      res.set('X-RateLimit-Reset', new Date(Date.now() + error.msBeforeNext).toISOString());

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      });
    }
    next();
  }
};

// Auth rate limit middleware
const authRateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.ip;
    await authLimiter.consume(key);
    next();
  } catch (error) {
    if (error.remainingPoints !== undefined) {
      res.set('Retry-After', Math.ceil(error.msBeforeNext / 1000));

      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      });
    }
    next();
  }
};

// Password reset rate limit middleware
const passwordResetRateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.body.email || req.ip;
    await passwordResetLimiter.consume(key);
    next();
  } catch (error) {
    if (error.remainingPoints !== undefined) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset attempts. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      });
    }
    next();
  }
};

// Purchase rate limit middleware
const purchaseRateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.user ? req.user._id.toString() : req.ip;
    await purchaseLimiter.consume(key);
    next();
  } catch (error) {
    if (error.remainingPoints !== undefined) {
      return res.status(429).json({
        success: false,
        message: 'Purchase limit exceeded. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      });
    }
    next();
  }
};

// Reset rate limiter for successful auth
const resetAuthLimit = async (key) => {
  try {
    await authLimiter.delete(key);
  } catch (error) {
    console.error('Error resetting auth rate limit:', error);
  }
};

module.exports = {
  rateLimitMiddleware,
  authRateLimitMiddleware,
  passwordResetRateLimitMiddleware,
  purchaseRateLimitMiddleware,
  resetAuthLimit,
};
