/**
 * Patterns where a user frames themselves as unattractive, undesirable, or
 * explicitly asks the system to justify poor matches or explain why they're
 * hard to date. Matching any of these should trigger a warm redirect rather
 * than allowing the LLM to engage with the framing.
 */
const NEGATIVE_SELF_PERCEPTION_PATTERNS: RegExp[] = [
  /\bi(?:'m| am)\s+(?:so\s+)?(?:ugly|unattractive|undesirable|worthless|pathetic|hopeless|unlovable|undateable|unfixable)/i,
  /no\s+one\s+(?:would|will|could)\s+(?:ever\s+)?(?:want|date|love|like|match\s+with)\s+me/i,
  /what['']?s?\s+wrong\s+with\s+me/i,
  /why\s+would\s+(?:anyone|someone)\s+(?:want|date|love|like)\s+me/i,
  /i\s+have\s+nothing\s+to\s+offer/i,
  /(?:explain|show|tell\s+me|prove|generate|create)\s+(?:\w+\s+){0,6}(?:why|how)\s+i(?:'m| am)\s+(?:undesirable|undateable|unlovable|unattractive|ugly|hard\s+to\s+love|a\s+bad\s+(?:catch|person|partner))/i,
  /(?:generate|show|find|create)\s+(?:matches?|profiles?)\s+(?:\w+\s+){0,8}(?:undesirable|unattractive|undateable|why\s+i(?:'m| am)|why\s+no\s+one)/i,
  /i(?:'m| am)\s+(?:a\s+)?(?:bad\s+(?:catch|person|partner)|nobody\s+special|not\s+worth\s+dating)/i,
  /(?:who\s+would\s+)?want\s+(?:to\s+date\s+)?someone\s+like\s+me/i,
];

/**
 * Patterns that indicate generated compatibility text is framing the user
 * negatively — implying they are difficult, undesirable, or flawed.
 * These should never appear in compatibilityNotes or challengePoint fields.
 */
const HARMFUL_OUTPUT_PATTERNS: RegExp[] = [
  /despite\s+(?:your|the\s+user['']?s?)\s+(?:\w+\s+)?(?:flaws?|weakness|awkward\w*|anti.?social|shyness|insecur\w*)/i,
  /even\s+though\s+(?:you|the\s+user)\s+(?:are|is|lack|struggle|tend\s+to)/i,
  /although\s+(?:you|the\s+user)\s+(?:are|is|tend\s+to|have|lack)/i,
  /someone\s+like\s+you\s+(?:would|might|could|should|can|may)/i,
  /for\s+(?:a\s+person|someone)\s+(?:who\s+is|like\s+you|with\s+your\s+\w+)/i,
  /your\s+(?:flaws?|limitations?|shortcomings?|inadequacies?|awkwardness|insecurities?)/i,
  /help\s+(?:you\s+)?overcome\s+(?:your\s+)?(?:shyness|awkward\w*|social\s+anxiety|insecurities?)/i,
  /(?:difficult|challenging|hard)\s+to\s+(?:match|date|find\s+a?\s+match\s+for)\s+(?:you|someone\s+like\s+you)/i,
  /you(?:'re| are)\s+(?:lucky|fortunate)\s+(?:to|that)/i,
];

/**
 * Returns true if the text contains language where the user is framing
 * themselves negatively or asking for confirmation of their undesirability.
 */
export function detectNegativeSelfPerception(text: string): boolean {
  return NEGATIVE_SELF_PERCEPTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns true if generated compatibility text contains language that could
 * reinforce negative self-perceptions about the user.
 */
export function containsHarmfulOutputLanguage(text: string): boolean {
  return HARMFUL_OUTPUT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Removes or replaces any harmful framing found in a compatibility text field.
 * Used as a post-generation safety net on compatibilityNotes and challengePoint.
 */
export function sanitizeCompatibilityText(
  text: string,
  fallback: string
): string {
  if (containsHarmfulOutputLanguage(text)) {
    return fallback;
  }
  return text;
}
