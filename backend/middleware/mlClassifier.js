/**
 * ============================================================
 * mlClassifier.js — FIREWALL STAGE 2: the ML Classifier
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: some attacks are paraphrased, so exact rules
 * miss them. This stage uses a trained Naive Bayes model to guess
 * whether a message "reads like" an attack. It only runs after
 * the Rule Engine has already let the message through.
 * ============================================================
 */
const crypto = require('crypto');
const { pool } = require('../config/db');
const { NaiveBayes } = require('../ml/naiveBayes');
const { logFirewallEvent, logRequest } = require('../utils/logger');

const classifier = new NaiveBayes();
const CONFIDENCE_THRESHOLD = Number(process.env.ML_CLASSIFIER_THRESHOLD || 0.7);

let lastTrainedAt = null;
let trainingCounts = { attack: 0, benign: 0 };

/**
 * ML CLASSIFIER (Firewall stage 2): loads all labeled examples from
 * ml_training_examples in MySQL and (re)trains the in-memory Naive Bayes
 * model. Called once at server startup, and again whenever an admin adds
 * examples via /add-rules and hits "Retrain".
 */
async function trainClassifier() {
  try {
    const [rows] = await pool.query('SELECT text, label FROM ml_training_examples');
    classifier.fit(rows);
    trainingCounts = {
      attack: rows.filter((r) => r.label === 'attack').length,
      benign: rows.filter((r) => r.label === 'benign').length,
    };
    lastTrainedAt = new Date();
    console.log(
      `[ml-classifier] trained on ${trainingCounts.attack} attack / ${trainingCounts.benign} benign examples`
    );
  } catch (err) {
    console.error('[ml-classifier] training failed — classifier will fail-open as benign:', err.message);
  }
}

function classifyPrompt(text) {
  return classifier.predict(text);
}

function getClassifierStats() {
  return {
    trained: classifier.trained,
    lastTrainedAt,
    trainingCounts,
    threshold: CONFIDENCE_THRESHOLD,
    vocabularySize: classifier.vocabulary.size,
  };
}

/**
 * Runs only after the Rule Engine has already passed the prompt through.
 * Flags prompts the hardcoded patterns missed but that "read like" an
 * attack based on word usage learned from the training set.
 */
async function mlClassifierMiddleware(req, res, next) {
  const { message, tier = 'medium' } = req.body || {};
  const result = classifyPrompt(message);

  if (result.label === 'attack' && result.confidence >= CONFIDENCE_THRESHOLD) {
    const sessionId = req.body.sessionId || crypto.randomUUID();
    const ip = req.ip;
    const confidencePct = Math.round(result.confidence * 100);

    logFirewallEvent({
      sessionId,
      direction: 'input',
      category: 'ml_classifier_attack_intent',
      matchedPattern: `naive_bayes confidence=${confidencePct}%`,
      snippet: message.slice(0, 120),
      ip,
    }).catch(() => {});

    logRequest({
      sessionId,
      tier,
      modelUsed: null,
      fallbackUsed: false,
      cacheHit: false,
      blocked: true,
      blockReason: 'ml_classifier_attack_intent',
      prompt: message,
      response: null,
      latencyMs: 0,
      ip,
    }).catch(() => {});

    return res.status(403).json({
      error: 'Blocked by AI Firewall — ML Classifier',
      stage: 'ml_classifier',
      category: 'ml_classifier_attack_intent',
      confidence: confidencePct,
      reason: `A Naive Bayes intent classifier flagged this prompt as a likely attack (${confidencePct}% confidence) based on its word patterns, even though it didn't match an explicit rule.`,
      sessionId,
    });
  }

  next();
}

module.exports = {
  trainClassifier,
  classifyPrompt,
  getClassifierStats,
  mlClassifierMiddleware,
  CONFIDENCE_THRESHOLD,
};
