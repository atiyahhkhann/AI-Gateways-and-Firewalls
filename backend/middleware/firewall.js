/**
 * ============================================================
 * firewall.js — FIREWALL STAGE 1: the Rule Engine
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this is a list of "if you see this, block it"
 * rules. It checks the user's message before the AI ever sees it.
 * It also cleans the AI's answer before it goes back to the user
 * (for example, replacing passwords or card numbers with
 * [REDACTED]).
 * ============================================================
 */
const crypto = require('crypto');
const { INPUT_RULES, OUTPUT_RULES } = require('./firewallPatterns');
const { getCustomRules } = require('./customRules');
const { logFirewallEvent, logRequest } = require('../utils/logger');

function snippet(text, len = 120) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

/**
 * RULE ENGINE (Firewall stage 1): explicit, hardcoded, deterministic.
 * Checks the built-in regex library (firewallPatterns.js) first, then any
 * user-defined keyword/regex rules added via /add-rules. No ML involved —
 * a match is a match.
 * Returns { blocked, category, matchedPattern, snippet } — never throws.
 */
function scanInput(text) {
  for (const rule of INPUT_RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          blocked: true,
          category: rule.category,
          matchedPattern: pattern.toString(),
          snippet: snippet(match[0]),
        };
      }
    }
  }

  for (const rule of getCustomRules('input')) {
    if (rule.test(text)) {
      return {
        blocked: true,
        category: rule.category,
        matchedPattern: rule.patternDisplay,
        snippet: snippet(text),
      };
    }
  }

  return { blocked: false };
}

/**
 * Scans / redacts model output before it ever reaches the client.
 * Applies both the built-in output rules and any custom output rules.
 * Returns { text, redactions: [{category, matchedPattern, snippet}] }
 */
function sanitizeOutput(text) {
  let clean = text;
  const redactions = [];

  for (const rule of OUTPUT_RULES) {
    for (const pattern of rule.patterns) {
      // Add the 'g' flag so we replace EVERY match, not just the first one.
      const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      clean = clean.replace(global, (match) => {
        redactions.push({ category: rule.category, matchedPattern: pattern.toString(), snippet: snippet(match) });
        return '[REDACTED]';
      });
    }
  }

  for (const rule of getCustomRules('output')) {
    const global = new RegExp(rule.regex.source, rule.regex.flags.includes('g') ? rule.regex.flags : rule.regex.flags + 'g');
    clean = clean.replace(global, (match) => {
      redactions.push({ category: rule.category, matchedPattern: rule.patternDisplay, snippet: snippet(match) });
      return '[REDACTED]';
    });
  }

  return { text: clean, redactions };
}

/**
 * Express middleware for Firewall stage 1 (Rule Engine). Validates the
 * request body, runs scanInput(), and short-circuits with a 403 + logs the
 * attempt on a match. Calls next() to hand off to the ML Classifier stage.
 */
function ruleEngineMiddleware(req, res, next) {
  const { message, tier = 'medium' } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 6000) {
    return res.status(400).json({ error: 'message too long (max 6000 chars)' });
  }

  const result = scanInput(message);
  if (result.blocked) {
    const sessionId = req.body.sessionId || crypto.randomUUID();
    const ip = req.ip;

    logFirewallEvent({
      sessionId, direction: 'input', category: result.category,
      matchedPattern: result.matchedPattern, snippet: result.snippet, ip,
    }).catch(() => {});
    logRequest({
      sessionId, tier, modelUsed: null, fallbackUsed: false, cacheHit: false,
      blocked: true, blockReason: result.category, prompt: message,
      response: null, latencyMs: 0, ip,
    }).catch(() => {});

    return res.status(403).json({
      error: 'Blocked by AI Firewall — Rule Engine',
      stage: 'rule_engine',
      category: result.category,
      reason: 'Your message matched a rule-engine pattern (built-in or custom) associated with prompt-injection / jailbreak attempts.',
      sessionId,
    });
  }

  next();
}

module.exports = { scanInput, sanitizeOutput, ruleEngineMiddleware };
