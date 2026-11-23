/**
 * ============================================================
 * admin.js — endpoints used by the /add-rules admin page
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this lets an admin list, add and delete custom
 * firewall rules and ML training examples, and press "Retrain"
 * to refresh the attack detector.
 * ============================================================
 */
const express = require('express');
const { pool } = require('../config/db');
const { listCustomRules, addCustomRule, deleteCustomRule } = require('../middleware/customRules');
const { trainClassifier, getClassifierStats } = require('../middleware/mlClassifier');

const router = express.Router();

// ------------------------------------------------------------------
// Custom Rules (Rule Engine) — the /add-rules "Rules" panel
// ------------------------------------------------------------------

router.get('/rules', async (req, res) => {
  try {
    const rules = await listCustomRules();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Could not load custom rules: ' + err.message });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const { ruleType, pattern, category, direction, severity } = req.body || {};
    const id = await addCustomRule({ ruleType, pattern, category, direction, severity });
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    await deleteCustomRule(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete rule: ' + err.message });
  }
});

// ------------------------------------------------------------------
// ML Training Data — the /add-rules "ML Classifier" panel
// ------------------------------------------------------------------

router.get('/ml-examples', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ml_training_examples ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not load training examples: ' + err.message });
  }
});

router.post('/ml-examples', async (req, res) => {
  try {
    const { text, label } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    if (!['attack', 'benign'].includes(label)) {
      return res.status(400).json({ error: 'label must be "attack" or "benign"' });
    }

    const [result] = await pool.execute(
      'INSERT INTO ml_training_examples (text, label) VALUES (?, ?)',
      [text.trim(), label]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Could not add training example: ' + err.message });
  }
});

router.delete('/ml-examples/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM ml_training_examples WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete example: ' + err.message });
  }
});

router.post('/ml-examples/retrain', async (req, res) => {
  await trainClassifier();
  res.json(getClassifierStats());
});

router.get('/ml-stats', (req, res) => {
  res.json(getClassifierStats());
});

module.exports = router;
