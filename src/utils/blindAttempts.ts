/**
 * Single source of truth for the "hands-free effective max attempts" rule.
 *
 * On the blind card (`speak_blind_en`) the English text is revealed after
 * `blindMaxErrorsBeforeReveal` errors; the user then needs at least one extra
 * attempt to actually read and repeat the revealed sentence.
 */
export function getHandsFreeEffectiveMaxAttempts(
  stepCard: string,
  handsFreeMaxAttempts = 2,
  blindMaxErrorsBeforeReveal = 2
): number {
  const baseMax = Math.max(1, handsFreeMaxAttempts || 2);
  if (stepCard === 'speak_blind_en' && blindMaxErrorsBeforeReveal > 0) {
    return Math.max(baseMax, blindMaxErrorsBeforeReveal + 1);
  }
  return baseMax;
}
