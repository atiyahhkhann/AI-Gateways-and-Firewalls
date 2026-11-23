/**
 * ============================================================
 * logger.js — save what happened into MySQL
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: every request and every firewall block/redaction
 * is written to a database table. If the database is unavailable,
 * we print a warning and carry on — logging never breaks the chat.
 * ============================================================
 */
const { pool } = require('../config/db');

async function logRequest({
  sessionId, tier, modelUsed, fallbackUsed, cacheHit,
  blocked, blockReason, prompt, response, latencyMs, ip
}) {
  console.log(
    `[gateway] tier=${tier} model=${modelUsed || '-'} cache=${cacheHit} ` +
    `fallback=${fallbackUsed} blocked=${blocked} latency=${latencyMs}ms`
  );
  try {
    await pool.execute(
      `INSERT INTO request_logs
        (session_id, tier, model_used, fallback_used, cache_hit, blocked, block_reason, prompt, response, latency_ms, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId, tier, modelUsed || null, fallbackUsed ? 1 : 0, cacheHit ? 1 : 0,
        blocked ? 1 : 0, blockReason || null, prompt || null, response || null,
        latencyMs || null, ip || null
      ]
    );
  } catch (err) {
    console.error('[logger] failed to persist request_log:', err.message);
  }
}

async function logFirewallEvent({ sessionId, direction, category, matchedPattern, snippet, ip }) {
  console.log(`[firewall] ${direction.toUpperCase()} blocked/redacted — category=${category}`);
  try {
    await pool.execute(
      `INSERT INTO firewall_logs (session_id, direction, category, matched_pattern, snippet, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, direction, category, matchedPattern || null, snippet || null, ip || null]
    );
  } catch (err) {
    console.error('[logger] failed to persist firewall_log:', err.message);
  }
}

module.exports = { logRequest, logFirewallEvent };
