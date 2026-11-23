/**
 * ============================================================
 * redis.js — connection to the Redis cache
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: Redis is a very fast temporary store. We use
 * it to remember answers we already gave, so the same question
 * does not need to call the (paid, slower) AI model again.
 * If Redis is not running, the app still works — it just skips
 * caching.
 * ============================================================
 */
const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    // Don't retry forever if redis-server isn't running — fail fast so the
    // rest of the app (which works fine without a cache) isn't held up.
    reconnectStrategy: (retries) => (retries > 2 ? false : 200)
  }
});

client.on('error', (err) => {
  // Don't crash the demo if redis hiccups — caching just degrades to "always miss".
  console.error('[redis] client error:', err.message);
});

async function connectRedis() {
  if (!client.isOpen) {
    try {
      await client.connect();
      console.log('[redis] connected ✔');
    } catch (err) {
      console.error('[redis] Could not connect. Is your local redis-server running?');
      console.error('[redis]', err.message);
    }
  }
}

module.exports = { client, connectRedis };
