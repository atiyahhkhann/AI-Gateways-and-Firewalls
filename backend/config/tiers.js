/**
 * ============================================================
 * tiers.js — the four priority levels (AI1 to AI4)
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: a "tier" is a priority level. Low questions use
 * a cheap, fast Gemini model; Critical questions use the strongest
 * model. Each tier also has a backup list (fallback chain) to try
 * if the first model is unavailable.
 * ============================================================
 */
/**
 * The gateway only talks to ONE provider right now (Google AI Studio / Gemini),
 * but we still get real "AI1 / AI2 / AI3 / AI4" tiering + fallback behaviour by
 * routing each priority level to a different Gemini model, with a fallback
 * chain of other Gemini models to try if the primary one errors out or is
 * rate-limited.
 *
 * If you later add another provider (OpenAI, Claude, etc.), just push its
 * model name onto the relevant chain — services/gatewayService.js does not
 * care which provider a model string belongs to as long as services/geminiService.js
 * knows how to call it.
 *
 * NOTE: Google renames/retires models fairly often. If a model below starts
 * 404ing, check the current list at https://ai.google.dev/gemini-api/docs/models
 * and swap the string — nothing else needs to change.
 */

const TIERS = {
  low: {
    id: 'low',
    label: 'AI1 · Low',
    description: 'Cheap, fast, everyday questions.',
    chain: ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
  },
  medium: {
    id: 'medium',
    label: 'AI2 · Medium',
    description: 'Balanced quality/speed for normal tasks.',
    chain: ['gemini-2.5-flash', 'gemini-3.5-flash']
  },
  high: {
    id: 'high',
    label: 'AI3 · High',
    description: 'Harder reasoning, worth the extra latency.',
    chain: ['gemini-3.1-pro', 'gemini-2.5-pro']
  },
  critical: {
    id: 'critical',
    label: 'AI4 · Critical',
    description: 'Highest-stakes tasks — max accuracy, full fallback chain.',
    chain: ['gemini-2.5-pro', 'gemini-3.1-pro', 'gemini-2.5-flash']
  }
};

function getTier(tierId) {
  return TIERS[tierId] || TIERS.medium;
}

module.exports = { TIERS, getTier };
