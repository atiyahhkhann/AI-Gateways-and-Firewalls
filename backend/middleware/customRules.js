/**
 * ============================================================
 * customRules.js — rules added from the /add-rules admin page
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: on top of the built-in rules, an admin can add
 * their own keywords or regex patterns. They are saved in MySQL,
 * then copied into a small in-memory list so the firewall can
 * check them very quickly on every message.
 * ============================================================
 */
const { pool } = require('../config/db');

let cache = { input: [], output: [] };

function compileRule(row) {
  let regex;

  if (row.rule_type === 'regex') {
    try {
      regex = new RegExp(row.pattern, 'i');
    } catch (err) {
      console.error(`[customRules] rule #${row.id} has invalid regex, skipping:`, err.message);
      return null;
    }
  } else {
    // keyword rule: escape regex special chars, match as a whole word/phrase
    const escaped = row.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(`\\b${escaped}\\b`, 'i');
  }

  return {
    id: row.id,
    direction: row.direction,
    category: `custom:${row.category}`,
    severity: row.severity,
    patternDisplay: row.pattern,
    regex,
    test(text) {
      return regex.test(text);
    },
  };
}

/** Reloads the in-memory rule cache from MySQL. Call after any add/delete. */
async function loadCustomRules() {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM custom_rules WHERE is_active = 1 ORDER BY created_at DESC'
    );
    const compiled = rows.map(compileRule).filter(Boolean);
    cache = {
      input: compiled.filter((r) => r.direction === 'input'),
      output: compiled.filter((r) => r.direction === 'output'),
    };
    console.log(
      `[customRules] loaded ${cache.input.length} input / ${cache.output.length} output custom rules`
    );
  } catch (err) {
    console.error('[customRules] failed to load from MySQL (using empty rule set):', err.message);
    cache = { input: [], output: [] };
  }
}

function getCustomRules(direction) {
  return cache[direction] || [];
}

async function addCustomRule({ ruleType, pattern, category, direction, severity }) {
  if (!pattern || !pattern.trim()) throw new Error('pattern is required');
  if (!['keyword', 'regex'].includes(ruleType)) {
    throw new Error('ruleType must be "keyword" or "regex"');
  }
  if (!['input', 'output'].includes(direction)) {
    throw new Error('direction must be "input" or "output"');
  }
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
    severity = 'medium';
  }
  if (ruleType === 'regex') {
    try {
      new RegExp(pattern);
    } catch (err) {
      throw new Error(`Invalid regex: ${err.message}`);
    }
  }

  const [result] = await pool.execute(
    'INSERT INTO custom_rules (rule_type, pattern, category, direction, severity) VALUES (?, ?, ?, ?, ?)',
    [ruleType, pattern.trim(), (category || 'custom_rule').trim(), direction, severity]
  );

  await loadCustomRules();
  return result.insertId;
}

async function deleteCustomRule(id) {
  await pool.execute('DELETE FROM custom_rules WHERE id = ?', [id]);
  await loadCustomRules();
}

async function listCustomRules() {
  const [rows] = await pool.query('SELECT * FROM custom_rules ORDER BY created_at DESC');
  return rows;
}

module.exports = { loadCustomRules, getCustomRules, addCustomRule, deleteCustomRule, listCustomRules };
