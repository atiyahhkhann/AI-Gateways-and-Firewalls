/**
 * ============================================================
 * monitor.js — statistics for the dashboard
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: these endpoints count things in the database
 * (total requests, cache hits, blocked messages, average speed)
 * so the frontend can show a live activity feed.
 * ============================================================
 */
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// Aggregate stats for the dashboard cards
router.get('/stats', async (req, res) => {
  try {
    const [[totals]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(cache_hit) AS cacheHits,
         SUM(blocked) AS blockedCount,
         SUM(fallback_used) AS fallbackCount,
         ROUND(AVG(latency_ms)) AS avgLatency
       FROM request_logs
       WHERE created_at >= (NOW() - INTERVAL 24 HOUR)`
    );

    const [tierBreakdown] = await pool.query(
      `SELECT tier, COUNT(*) AS count
       FROM request_logs
       WHERE created_at >= (NOW() - INTERVAL 24 HOUR)
       GROUP BY tier`
    );

    const [[firewallTotals]] = await pool.query(
      `SELECT COUNT(*) AS total FROM firewall_logs WHERE created_at >= (NOW() - INTERVAL 24 HOUR)`
    );

    res.json({
      total: totals.total || 0,
      cacheHits: Number(totals.cacheHits) || 0,
      blockedCount: Number(totals.blockedCount) || 0,
      fallbackCount: Number(totals.fallbackCount) || 0,
      avgLatency: totals.avgLatency || 0,
      firewallEvents: firewallTotals.total || 0,
      tierBreakdown
    });
  } catch (err) {
    console.error('[monitor] stats error:', err.message);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// Recent activity feed (both request + firewall events, merged and sorted)
router.get('/activity', async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT id, 'request' AS type, tier, model_used AS modelUsed, cache_hit AS cacheHit,
              blocked, block_reason AS blockReason, fallback_used AS fallbackUsed,
              latency_ms AS latencyMs, created_at AS createdAt
       FROM request_logs ORDER BY created_at DESC LIMIT 25`
    );
    const [firewall] = await pool.query(
      `SELECT id, 'firewall' AS type, direction, category, snippet, created_at AS createdAt
       FROM firewall_logs ORDER BY created_at DESC LIMIT 25`
    );

    const merged = [...requests, ...firewall]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 30);

    res.json(merged);
  } catch (err) {
    console.error('[monitor] activity error:', err.message);
    res.status(500).json({ error: 'Could not load activity feed' });
  }
});

module.exports = router;
