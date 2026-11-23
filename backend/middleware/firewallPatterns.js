/**
 * ============================================================
 * firewallPatterns.js — the built-in block/redact patterns
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this file holds the actual text patterns the
 * Rule Engine looks for. INPUT_RULES = bad things a user might
 * type. OUTPUT_RULES = secret-looking things the AI might say.
 * A regular expression (regex) is just a fancy "find this text"
 * instruction.
 * ============================================================
 */
/**
 * Pattern library for the AI Firewall.
 *
 * This is intentionally regex-based and readable rather than ML-based —
 * it's a demo of the CONCEPT of an AI firewall (a policy layer that sits
 * between the user and the model), not a production-grade jailbreak
 * classifier. Treat it as a starting point you'd keep tuning in real life.
 */

// ---------- INPUT patterns (things a user might send) ----------
const INPUT_RULES = [
  {
    category: 'jailbreak_instruction_override',
    patterns: [
      /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
      /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
      /forget\s+(all\s+)?(your\s+)?(previous\s+)?instructions?/i,
      /please\s+ignore\s+instructions?/i,
      /you\s+(no\s+longer\s+)?have\s+no\s+rules/i,
      /reveal\s+your\s+(system\s+prompt|instructions)/i,
      /what\s+(is|are)\s+your\s+(system\s+prompt|hidden\s+instructions)/i
    ]
  },
  {
    category: 'roleplay_jailbreak',
    patterns: [
      /\bDAN\b\s*(mode)?/i,                       // "DAN" / "DAN mode" jailbreak persona
      /developer\s+mode/i,
      /act\s+as\s+(if\s+you\s+are\s+)?(an?\s+)?(unfiltered|unrestricted|jailbroken)/i,
      /pretend\s+(you\s+are|to\s+be)\s+.*(no\s+restrictions|without\s+rules)/i,
      /role[\s-]?play\s+as\s+.*(unfiltered|no\s+rules|no\s+restrictions)/i,
      /you\s+are\s+now\s+.*(and\s+have\s+no|with\s+no)\s+(restrictions|filters|rules)/i
    ]
  },
  {
    category: 'data_poisoning_attempt',
    patterns: [
      /remember\s+this\s+(forever|permanently)\s+as\s+(a\s+)?fact/i,
      /from\s+now\s+on,?\s+always\s+(say|respond|answer|tell\s+everyone)/i,
      /update\s+your\s+(training|knowledge)\s+(data|base)\s+(with|to)/i,
      /inject\s+the\s+following\s+into\s+your\s+(memory|training)/i
    ]
  },
  {
    category: 'encoding_attack',
    patterns: [
      /[A-Za-z0-9+/]{60,}={0,2}/,                 // long base64-looking blob
      /(?:\\x[0-9a-f]{2}){6,}/i,                    // hex-escape smuggling
      /(?:%[0-9a-f]{2}){6,}/i,                      // URL-encoded smuggling
      /(?:\\u[0-9a-f]{4}){6,}/i                     // unicode-escape smuggling
    ]
  },
  {
    category: 'language_switch_evasion',
    patterns: [
      /answer\s+in\s+\w+\s+(so|to)\s+(that\s+)?(the\s+)?(filter|rules?|guardrails?)\s+(don't|won't|can't)/i,
      /translate\s+(this|the\s+following)\s+and\s+(then\s+)?execute/i,
      /respond\s+only\s+in\s+\w+\s+to\s+avoid\s+detection/i
    ]
  }
];

// ---------- OUTPUT patterns (things the model might leak back) ----------
const OUTPUT_RULES = [
  {
    category: 'sensitive_credential_leak',
    patterns: [
      /password\s*[:=]\s*\S+/i,
      /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+/i,
      /\bcredentials?\s*[:=]\s*\S+/i,
      /AKIA[0-9A-Z]{16}/,                          // AWS access key id shape
      /-----BEGIN\s+(RSA|EC|OPENSSH)?\s?PRIVATE KEY-----/i
    ]
  },
  {
    category: 'payment_data_leak',
    patterns: [
      /\b(?:\d[ -]*?){13,16}\b/                     // card-number-shaped digit run
    ]
  }
];

module.exports = { INPUT_RULES, OUTPUT_RULES };
