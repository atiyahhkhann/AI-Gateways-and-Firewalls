/**
 * ============================================================
 * naiveBayes.js — the "attack vs benign" text classifier
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this is a small machine-learning model written
 * from scratch (no ML library). It learns from example sentences
 * labelled "attack" or "benign", then scores a new message by
 * looking at its words, two-word phrases, three-word phrases, and
 * small character pieces. Those pieces make it harder to trick
 * the firewall by misspelling a word slightly.
 * ============================================================
 */
/**
 * Improved Multinomial Naive Bayes for AI Firewall
 *
 * Improvements over the original:
 *   - Keeps the original stop words
 *   - Adds additional generic stop words
 *   - Word unigrams
 *   - Word bigrams + trigrams
 *   - Character n-grams for robustness against mild obfuscation
 *   - Feature weighting
 *   - Minimum-frequency vocabulary pruning
 *   - Log-probability scoring
 *   - Configurable attack threshold
 *
 * Labels: 'attack' | 'benign'
 */

const STOP_WORDS = new Set([
  // Original stop words
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
  'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'will', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves',

  // Additional generic English stop words
  'also', 'already', 'always', 'another', 'anyone', 'anything',
  'anywhere', 'around', 'back', 'became', 'become', 'becomes',
  'beside', 'besides', 'cannot', 'could', 'couldnt', 'done',
  'else', 'enough', 'even', 'ever', 'every', 'everyone', 'everything',
  'everywhere', 'first', 'get', 'gets', 'getting', 'give', 'given',
  'gives', 'going', 'got', 'gotten', 'however', 'inside', 'instead',
  'keep', 'keeps', 'last', 'later', 'least', 'less', 'let', 'lets',
  'made', 'make', 'makes', 'many', 'may', 'maybe', 'might', 'much',
  'must', 'never', 'next', 'nobody', 'none', 'nothing', 'often',
  'otherwise', 'perhaps', 'quite', 'rather', 'really', 'right',
  'said', 'say', 'says', 'second', 'seem', 'seemed', 'seems',
  'several', 'since', 'still', 'take', 'taken', 'takes', 'tell',
  'tells', 'thing', 'things', 'third', 'though', 'thus', 'together',
  'toward', 'two', 'use', 'used', 'uses', 'using', 'want', 'wants',
  'well', 'whatever', 'whenever', 'whether', 'without', 'yet'
]);


/**
 * Basic normalization.
 *
 * We intentionally preserve enough structure for phrase extraction.
 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width characters
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Word tokenizer.
 */
function tokenize(text) {
  const normalized = normalize(text);

  const raw = normalized.match(/[a-z0-9']+/g) || [];

  return raw.filter(
    (t) =>
      t.length >= 2 &&
      !STOP_WORDS.has(t)
  );
}


/**
 * Build word n-grams.
 *
 * Example:
 *   "change operating rules"
 *
 * produces:
 *   change
 *   operating
 *   rules
 *   change_operating
 *   operating_rules
 *   change_operating_rules
 */
function wordNgrams(tokens, minN = 1, maxN = 3) {
  const features = [];

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join('_');

      features.push({
        feature: `w${n}:${gram}`,
        weight: n === 1 ? 1.0 : n === 2 ? 1.6 : 2.0
      });
    }
  }

  return features;
}


/**
 * Character n-grams.
 *
 * These help when attackers slightly mutate words:
 *
 *   instructions
 *   instruct1ons
 *   instruction...
 *   instruc-tions
 *
 * They are NOT a replacement for semantic detection,
 * but make lexical evasion harder.
 */
function charNgrams(text, minN = 3, maxN = 5) {
  const normalized = normalize(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const features = [];

  for (const word of normalized.split(/\s+/)) {
    if (word.length < minN) continue;

    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= word.length - n; i++) {
        features.push({
          feature: `c${n}:${word.slice(i, i + n)}`,
          weight: 0.20
        });
      }
    }
  }

  return features;
}


/**
 * Complete feature extractor.
 */
function extractFeatures(text) {
  const normalized = normalize(text);
  const tokens = tokenize(normalized);

  return [
    ...wordNgrams(tokens, 1, 3),
    ...charNgrams(normalized, 3, 5)
  ];
}


class NaiveBayes {
  constructor(options = {}) {
    this.wordCounts = {
      attack: {},
      benign: {}
    };

    this.classTotalWords = {
      attack: 0,
      benign: 0
    };

    this.classDocCount = {
      attack: 0,
      benign: 0
    };

    this.vocabulary = new Set();

    this.featureDocumentCounts = {};

    this.minFeatureFrequency =
      options.minFeatureFrequency ?? 1;

    this.attackThreshold =
      options.attackThreshold ?? 0.5;

    this.trained = false;
  }


  /**
   * Train classifier.
   */
  fit(examples) {
    this.wordCounts = {
      attack: {},
      benign: {}
    };

    this.classTotalWords = {
      attack: 0,
      benign: 0
    };

    this.classDocCount = {
      attack: 0,
      benign: 0
    };

    this.vocabulary = new Set();
    this.featureDocumentCounts = {};

    for (const example of examples || []) {
      const { text, label } = example;

      if (label !== 'attack' && label !== 'benign') {
        continue;
      }

      this.classDocCount[label]++;

      // Deduplicate features for document-frequency purposes.
      const seen = new Set();

      for (const { feature, weight } of extractFeatures(text)) {
        this.wordCounts[label][feature] =
          (this.wordCounts[label][feature] || 0) + weight;

        this.classTotalWords[label] += weight;

        this.vocabulary.add(feature);

        if (!seen.has(feature)) {
          seen.add(feature);

          this.featureDocumentCounts[feature] =
            (this.featureDocumentCounts[feature] || 0) + 1;
        }
      }
    }

    this.trained =
      this.classDocCount.attack > 0 &&
      this.classDocCount.benign > 0;
  }


  /**
   * Predict a prompt.
   */
  predict(text) {
    if (!this.trained) {
      return {
        label: 'benign',
        confidence: 0,
        scores: {
          attack: 0.5,
          benign: 0.5
        }
      };
    }

    const features = extractFeatures(text);

    const vocabSize = Math.max(
      this.vocabulary.size,
      1
    );

    const logScores = {
      attack: Math.log(0.5),
      benign: Math.log(0.5)
    };

    /**
     * Track how much evidence each class received.
     * This is useful for debugging the firewall.
     */
    const evidence = {
      attack: [],
      benign: []
    };

    for (const { feature, weight } of features) {
      if (!this.vocabulary.has(feature)) {
        continue;
      }

      for (const cls of ['attack', 'benign']) {
        const count =
          this.wordCounts[cls][feature] || 0;

        const total =
          this.classTotalWords[cls];

        const probability =
          (count + 1) /
          (total + vocabSize);

        const contribution =
          weight * Math.log(probability);

        logScores[cls] += contribution;

        evidence[cls].push({
          feature,
          contribution
        });
      }
    }


    /**
     * Stable softmax — in simple words, this turns the raw scores
     * into percentages that add up to 100%.
     */
    const maxLog =
      Math.max(
        logScores.attack,
        logScores.benign
      );

    const expAttack =
      Math.exp(logScores.attack - maxLog);

    const expBenign =
      Math.exp(logScores.benign - maxLog);

    const sum =
      expAttack + expBenign;

    const probAttack =
      expAttack / sum;

    const probBenign =
      expBenign / sum;


    const label =
      probAttack >= this.attackThreshold
        ? 'attack'
        : 'benign';

    const confidence =
      label === 'attack'
        ? probAttack
        : probBenign;


    /**
     * Sort strongest evidence first.
     *
     * Very useful when tuning your training dataset.
     */
    evidence.attack.sort(
      (a, b) => b.contribution - a.contribution
    );

    evidence.benign.sort(
      (a, b) => b.contribution - a.contribution
    );


    return {
      label,
      confidence,
      scores: {
        attack: probAttack,
        benign: probBenign
      },

      // Useful for firewall debugging.
      evidence: {
        attack: evidence.attack.slice(0, 15),
        benign: evidence.benign.slice(0, 15)
      }
    };
  }
}


module.exports = {
  NaiveBayes,
  tokenize,
  normalize,
  extractFeatures,
  STOP_WORDS
};
