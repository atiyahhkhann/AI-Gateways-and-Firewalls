/**
 * ============================================================
 * chat.js — the /api/chat route, where the whole pipeline lives
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this file connects the five stages in order:
 * Rule Engine -> ML Classifier -> Rate Limit -> Cache -> Routing.
 * Express runs them one after another for every chat message.
 * ============================================================
 */
const express = require('express');
const crypto = require('crypto');

const { chatRateLimiter } = require('../middleware/rateLimiter');
const { ruleEngineMiddleware, sanitizeOutput } = require('../middleware/firewall');
const { mlClassifierMiddleware } = require('../middleware/mlClassifier');
const { getCached, setCached } = require('../middleware/cache');
const { generateWithFallback } = require('../services/gatewayService');
const { getTier, TIERS } = require('../config/tiers');
const { logRequest, logFirewallEvent } = require('../utils/logger');

const router = express.Router();

router.get('/tiers', (req, res) => {
  res.json(Object.values(TIERS).map((t) => ({ id: t.id, label: t.label, description: t.description })));
});

/**
 * ===========================================================================
 *  AI GATEWAY — stage 2: Cache
 * ===========================================================================
 * By the time a request reaches here it has already passed both AI Firewall
 * stages (Rule Engine + ML Classifier) and the Gateway's Rate Limit stage.
 * Checks Redis for a cached response for this (tier, message) pair. A hit
 * responds immediately — the request never reaches "Routing" or the model.
 */
async function cacheCheckMiddleware(req, res, next) {
  const { message, tier: tierId = 'medium' } = req.body;
  const sessionId = req.body.sessionId || crypto.randomUUID();
  const tier = getTier(tierId);
  const start = Date.now();

  req.sessionId = sessionId;
  req.tier = tier;
  req.gatewayStart = start;

  const cached = await getCached(tier.id, message);
  if (!cached) return next();

  const latencyMs = Date.now() - start;
  await logRequest({
    sessionId, tier: tier.id, modelUsed: cached.modelUsed, fallbackUsed: false,
    cacheHit: true, blocked: false, prompt: message, response: cached.text,
    latencyMs, ip: req.ip,
  });

  res.json({
    reply: cached.text, tier: tier.id, tierLabel: tier.label,
    modelUsed: cached.modelUsed, fallbackUsed: false, cacheHit: true, latencyMs, sessionId,
  });
}

/**
 * ===========================================================================
 *  AI GATEWAY — stage 3: Routing
 * ===========================================================================
 * Only reached on a cache miss. Picks a model chain for this tier (with
 * automatic fallback if the primary model is unavailable), calls it, then
 * runs the Firewall's output scan/redaction before anything reaches the
 * client, and caches the clean result for next time.
 */
async function routingHandler(req, res) {
  const { message } = req.body;
  const { tier, sessionId, gatewayStart: start } = req;

  try {
    const { text, modelUsed, fallbackUsed } = await generateWithFallback(tier.id, message);

    const { text: cleanText, redactions } = sanitizeOutput(text);
    for (const r of redactions) {
      await logFirewallEvent({
        sessionId, direction: 'output', category: r.category,
        matchedPattern: r.matchedPattern, snippet: r.snippet, ip: req.ip,
      });
    }

    await setCached(tier.id, message, { text: cleanText, modelUsed });

    const latencyMs = Date.now() - start;
    await logRequest({
      sessionId, tier: tier.id, modelUsed, fallbackUsed, cacheHit: false,
      blocked: false, prompt: message, response: cleanText, latencyMs, ip: req.ip,
    });

    res.json({
      reply: cleanText, tier: tier.id, tierLabel: tier.label,
      modelUsed, fallbackUsed, cacheHit: false,
      redacted: redactions.length > 0, latencyMs, sessionId,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error('[gateway/routing] error:', err.message);
    await logRequest({
      sessionId, tier: tier.id, modelUsed: null, fallbackUsed: false, cacheHit: false,
      blocked: false, blockReason: 'upstream_error', prompt: message,
      response: null, latencyMs, ip: req.ip,
    });
    res.status(502).json({ error: 'All AI models in this tier are unavailable right now. Try again shortly.' });
  }
}

/**
 * ===========================================================================
 *  Pipeline order — matches the architecture diagram exactly:
 *
 *  User -> [ AI FIREWALL: Rule Engine -> ML Classifier ]
 *       -> [ AI GATEWAY:  Rate Limit -> Cache -> Routing ] -> AI Model
 * ===========================================================================
 */
router.post(
  '/chat',
  ruleEngineMiddleware,    // FIREWALL 1 — hardcoded regex/keyword rules + custom rules
  mlClassifierMiddleware,  // FIREWALL 2 — Naive Bayes intent classifier
  chatRateLimiter,         // GATEWAY 1  — rate limit
  cacheCheckMiddleware,    // GATEWAY 2  — cache (may short-circuit the response here)
  routingHandler           // GATEWAY 3  — routing + model call + output firewall scan
);

module.exports = router;
