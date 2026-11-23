/**
 * ============================================================
 * cache.js — remember answers we have already given
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: we turn the question + tier into a unique key
 * (a hash), then store the answer in Redis under that key. Next
 * time the same question is asked, we return the saved answer
 * instantly instead of calling the AI model again.
 * ============================================================
 */
const crypto = require('crypto');
const { client } = require('../config/redis');

const TTL = Number(process.env.CACHE_TTL_SECONDS || 3600);

function cacheKey(tier, message) {
  // Trim + lower-case means "Hello" and " hello " count as the same question.
  const normalized = message.trim().toLowerCase();
  // A hash turns the question into a short, fixed-size key that is safe to store.
  const hash = crypto.createHash('sha256').update(`${tier}:${normalized}`).digest('hex');
  return `chat:cache:${hash}`;
}

async function getCached(tier, message) {
  if (!client.isOpen) return null;
  try {
    const key = cacheKey(tier, message);
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('[cache] read failed:', err.message);
    return null; // degrade gracefully — treat as cache miss
  }
}

async function setCached(tier, message, payload) {
  if (!client.isOpen) return;
  try {
    const key = cacheKey(tier, message);
    await client.set(key, JSON.stringify(payload), { EX: TTL });
  } catch (err) {
    console.error('[cache] write failed:', err.message);
  }
}

module.exports = { getCached, setCached, cacheKey, TTL };
