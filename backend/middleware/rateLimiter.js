/**
 * ============================================================
 * rateLimiter.js — GATEWAY STAGE 1: slow down heavy users
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: if one user sends more than 20 messages in a
 * minute, we reply with an error instead of letting them spam the
 * AI model. This protects the service from overload and abuse.
 * ============================================================
 */
const rateLimit = require('express-rate-limit');

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const max = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 20);

const chatRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Slow down and try again shortly.' },
  handler: (req, res, next, options) => {
    req.rateLimited = true;
    res.status(options.statusCode).json(options.message);
  }
});

module.exports = { chatRateLimiter, windowMs, max };
