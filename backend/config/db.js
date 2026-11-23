/**
 * ============================================================
 * db.js — connection to the MySQL database
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this is the "memory" of the app. MySQL stores
 * the logs, the custom firewall rules, and the examples used to
 * train the attack detector. We use a pool of connections so
 * several requests can talk to the database at the same time.
 * ============================================================
 */
const mysql = require('mysql2/promise');

// A pool is enough for a demo — mysql2 handles reconnects for us.
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'app_user',
  password: process.env.MYSQL_PASSWORD || 'my_password',
  database: process.env.MYSQL_DATABASE || 'ai_gateway_demo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[db] MySQL connected ✔');
  } catch (err) {
    console.error('[db] Could not connect to MySQL. Did you import db/schema.sql?');
    console.error('[db]', err.message);
  }
}

module.exports = { pool, testConnection };
