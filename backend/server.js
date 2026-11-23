/**
 * ============================================================
 * server.js — the main entry point of the backend
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this file starts the whole server. It loads the
 * settings, connects to MySQL and Redis, loads the firewall rules,
 * trains the attack detector, and then listens for requests on
 * port 4000.
 * ============================================================
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { testConnection } = require('./config/db');
const { connectRedis } = require('./config/redis');
const chatRoutes = require('./routes/chat');
const monitorRoutes = require('./routes/monitor');
const adminRoutes = require('./routes/admin');
const { loadCustomRules } = require('./middleware/customRules');
const { trainClassifier } = require('./middleware/mlClassifier');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
// Chat requests go through the firewall + gateway pipeline in routes/chat.js.
app.use('/api', chatRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/admin', adminRoutes);

async function start() {
  await testConnection();
  await connectRedis();

  // Rule Engine's custom rules and the ML Classifier both live in MySQL,
  // so both need an initial load before the firewall can do its job.
  await loadCustomRules();
  await trainClassifier();

  app.listen(PORT, () => {
    console.log(`\n🚪 AI Gateway + Firewall demo backend running on http://localhost:${PORT}`);
    console.log('   Pipeline: Rule Engine -> ML Classifier -> Rate Limit -> Cache -> Routing');
    console.log('   Open frontend/index.html (chat) or frontend/add-rules.html (manage rules).\n');
  });
}

start();
