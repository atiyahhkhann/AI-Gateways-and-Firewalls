/**
 * ============================================================
 * add-rules.js — brain of the admin page
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this file loads the custom rules and training
 * examples from the backend, shows them in tables, and sends
 * add/delete/retrain actions when an admin clicks a button.
 * ============================================================
 */
const API_BASE = 'http://localhost:4000/api';

// ---------------------------- tabs ----------------------------

const tabButtons = document.querySelectorAll('.tab-btn');
const panels = { rules: document.getElementById('tab-rules'), ml: document.getElementById('tab-ml') };

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(panels).forEach(([key, panel]) => {
      panel.classList.toggle('hidden', key !== btn.dataset.tab);
    });
  });
});

// ---------------------------- helpers ----------------------------

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function showMsg(node, text, isError) {
  node.textContent = text;
  node.className = 'form-msg ' + (isError ? 'error' : 'success');
  setTimeout(() => { node.textContent = ''; node.className = 'form-msg'; }, 4000);
}

// ---------------------------- custom rules ----------------------------

const ruleForm = document.getElementById('ruleForm');
const ruleFormMsg = document.getElementById('ruleFormMsg');
const rulesTableBody = document.getElementById('rulesTableBody');

async function loadRules() {
  try {
    const res = await fetch(`${API_BASE}/admin/rules`);
    const rules = await res.json();
    renderRules(rules);
  } catch (err) {
    rulesTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Could not reach the backend.</td></tr>`;
  }
}

function renderRules(rules) {
  if (!rules.length) {
    rulesTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No custom rules yet — add one above.</td></tr>`;
    return;
  }

  rulesTableBody.innerHTML = '';
  rules.forEach((r) => {
    const tr = el('tr');
    tr.innerHTML = `
      <td><span class="pill pill-${r.rule_type}">${r.rule_type}</span></td>
      <td><code>${escapeHtml(r.pattern)}</code></td>
      <td>${escapeHtml(r.category)}</td>
      <td><span class="pill pill-${r.direction}">${r.direction}</span></td>
      <td><span class="pill pill-${r.severity}">${r.severity}</span></td>
      <td>${formatDate(r.created_at)}</td>
      <td><button class="row-delete" data-id="${r.id}">Delete</button></td>
    `;
    tr.querySelector('.row-delete').addEventListener('click', () => deleteRule(r.id));
    rulesTableBody.appendChild(tr);
  });
}

async function deleteRule(id) {
  try {
    await fetch(`${API_BASE}/admin/rules/${id}`, { method: 'DELETE' });
    loadRules();
  } catch (err) {
    alert('Could not delete rule: ' + err.message);
  }
}

ruleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = ruleForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const body = {
    ruleType: document.getElementById('ruleType').value,
    direction: document.getElementById('ruleDirection').value,
    severity: document.getElementById('ruleSeverity').value,
    pattern: document.getElementById('rulePattern').value.trim(),
    category: document.getElementById('ruleCategory').value.trim() || 'custom_rule',
  };

  try {
    const res = await fetch(`${API_BASE}/admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add rule');

    showMsg(ruleFormMsg, '✓ Rule added', false);
    document.getElementById('rulePattern').value = '';
    document.getElementById('ruleCategory').value = '';
    loadRules();
  } catch (err) {
    showMsg(ruleFormMsg, err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------- ML training data ----------------------------

const mlForm = document.getElementById('mlForm');
const mlFormMsg = document.getElementById('mlFormMsg');
const mlTableBody = document.getElementById('mlTableBody');
const retrainBtn = document.getElementById('retrainBtn');

async function loadMlExamples() {
  try {
    const res = await fetch(`${API_BASE}/admin/ml-examples`);
    const examples = await res.json();
    renderMlExamples(examples);
  } catch (err) {
    mlTableBody.innerHTML = `<tr><td colspan="4" class="table-empty">Could not reach the backend.</td></tr>`;
  }
}

function renderMlExamples(examples) {
  if (!examples.length) {
    mlTableBody.innerHTML = `<tr><td colspan="4" class="table-empty">No training examples yet.</td></tr>`;
    return;
  }

  mlTableBody.innerHTML = '';
  examples.forEach((ex) => {
    const tr = el('tr');
    tr.innerHTML = `
      <td><span class="pill pill-${ex.label}">${ex.label}</span></td>
      <td>${escapeHtml(ex.text)}</td>
      <td>${formatDate(ex.created_at)}</td>
      <td><button class="row-delete" data-id="${ex.id}">Delete</button></td>
    `;
    tr.querySelector('.row-delete').addEventListener('click', () => deleteMlExample(ex.id));
    mlTableBody.appendChild(tr);
  });
}

async function deleteMlExample(id) {
  try {
    await fetch(`${API_BASE}/admin/ml-examples/${id}`, { method: 'DELETE' });
    loadMlExamples();
  } catch (err) {
    alert('Could not delete example: ' + err.message);
  }
}

mlForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = mlForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const body = {
    text: document.getElementById('mlText').value.trim(),
    label: document.getElementById('mlLabel').value,
  };

  try {
    const res = await fetch(`${API_BASE}/admin/ml-examples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add example');

    showMsg(mlFormMsg, '✓ Example added — remember to retrain', false);
    document.getElementById('mlText').value = '';
    loadMlExamples();
  } catch (err) {
    showMsg(mlFormMsg, err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/ml-stats`);
    const stats = await res.json();
    renderStats(stats);
  } catch (err) {
    // stay quiet, table load already reports backend issues
  }
}

function renderStats(stats) {
  document.getElementById('mlStatAttack').textContent = stats.trainingCounts.attack;
  document.getElementById('mlStatBenign').textContent = stats.trainingCounts.benign;
  document.getElementById('mlStatVocab').textContent = stats.vocabularySize;
  document.getElementById('mlStatThreshold').textContent = Math.round(stats.threshold * 100) + '%';
  document.getElementById('mlLastTrained').textContent = stats.lastTrainedAt
    ? `Last trained: ${formatDate(stats.lastTrainedAt)}`
    : 'Not trained yet.';
}

retrainBtn.addEventListener('click', async () => {
  retrainBtn.disabled = true;
  retrainBtn.textContent = 'Retraining…';
  try {
    const res = await fetch(`${API_BASE}/admin/ml-examples/retrain`, { method: 'POST' });
    const stats = await res.json();
    renderStats(stats);
  } catch (err) {
    alert('Retrain failed: ' + err.message);
  } finally {
    retrainBtn.disabled = false;
    retrainBtn.textContent = '↻ Retrain classifier now';
  }
});

// ---------------------------- boot ----------------------------

loadRules();
loadMlExamples();
loadStats();
