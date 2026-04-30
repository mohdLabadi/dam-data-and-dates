import { generateText } from "ai";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import type { getClassifierModel } from "@/lib/ai/providers";

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

const CLASSIFIER_SYSTEM_PROMPT = `You are a content safety classifier for a dating app. Your only job is to detect whether a user message contains negative self-perception framing that could be harmful.

Flag a message YES if the user:
- Describes themselves as unattractive, ugly, unlovable, undesirable, worthless, or undateable
- Says no one would want them, date them, or love them
- Asks why they can't find anyone or why no one wants them
- Requests matches or explanations based on the premise that they are undesirable or a bad catch
- Expresses that they have nothing to offer or are not worth dating
- Uses indirect self-deprecation that implies they are too flawed to be loved (e.g. "let's be honest, I'm not exactly a catch", "I'll never find anyone", "nobody would swipe right on me", "I'm too awkward/old/boring for anyone")

Do NOT flag messages that are:
- Normal preference statements ("no smokers", "I want someone kind")
- Questions about the app or process
- Expressions of general dating anxiety that don't frame the user as fundamentally undesirable

Reply with only the single word YES or NO.`;

/**
 * Returns true if the text contains language where the user is framing
 * themselves negatively or asking for confirmation of their undesirability.
 */
export function detectNegativeSelfPerception(text: string): boolean {
  return NEGATIVE_SELF_PERCEPTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Classifies whether a user message contains negative self-perception framing,
 * using regex as a zero-latency fast path and an LLM for cases regex misses.
 * Falls back to false (no block) if the classifier call fails or times out.
 */
export async function classifyNegativeSelfPerception(
  text: string,
  model: ReturnType<typeof getClassifierModel>
): Promise<boolean> {
  // Fast path: regex catches obvious cases with zero added latency.
  if (detectNegativeSelfPerception(text)) {
    return true;
  }

  // Skip LLM for very short or empty messages unlikely to contain harmful framing.
  if (text.trim().length < 8) {
    return false;
  }

  const CLASSIFIER_TIMEOUT_MS = 4_000;

  try {
    const result = await Promise.race([
      generateText({
        model,
        system: CLASSIFIER_SYSTEM_PROMPT,
        prompt: text,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), CLASSIFIER_TIMEOUT_MS)
      ),
    ]);

    if (!result) {
      return false; // timed out — fail open
    }

    return result.text.trim().toUpperCase().startsWith("YES");
  } catch {
    return false; // fail open — don't block the conversation on classifier errors
  }
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

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+\b/gi;
const SOCIAL_HANDLE_PATTERN = /(^|\s)@[a-z0-9_]{2,30}\b/gi;
const COORDINATE_PATTERN = /\b-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/g;
const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'\-\s]{2,}\s(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b/gi;

export function redactSensitiveContactInfo(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(PHONE_PATTERN, "[redacted]")
    .replace(URL_PATTERN, "[redacted]")
    .replace(SOCIAL_HANDLE_PATTERN, " [redacted]")
    .replace(COORDINATE_PATTERN, "[redacted]")
    .replace(STREET_ADDRESS_PATTERN, "[redacted]")
    .trim();
}

export function coarseLocation(location: string): string {
  const raw = redactSensitiveContactInfo(location || "");

  if (!raw) {
    return "Area shared on match";
  }

  // Keep only coarse geography (usually city + state/country) and avoid street-level detail.
  const segments = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0]}, ${segments[1]}`;
  }

  return segments[0] ?? "Area shared on match";
}

export function sanitizeProfileForPrivacy(profile: PartnerProfile): PartnerProfile {
  return {
    ...profile,
    location: coarseLocation(profile.location),
    bio: redactSensitiveContactInfo(profile.bio),
    occupation: redactSensitiveContactInfo(profile.occupation),
    compatibilityNotes: redactSensitiveContactInfo(profile.compatibilityNotes),
    challengePoint: redactSensitiveContactInfo(profile.challengePoint),
  };
}
