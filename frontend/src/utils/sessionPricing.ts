/**
 * iter102ag — Single source of truth for resolving session prices on the
 * client. Solves the "trainer set rates but trainee sees `$—` and the
 * profile shows a hardcoded `$30/30 min` badge" bug.
 *
 * Field priority (high → low):
 *   1. `tierRates.{modality}{duration}Cents`  — newest per-duration field
 *      (e.g. `tierRates.inPerson60Cents`, `tierRates.virtual30Cents`)
 *   2. `{modality}{duration}Cents` flat alias  — pre-tierRates schema
 *      (e.g. `inPerson60Cents`, `virtual30Cents`)
 *   3. `outdoorRateCents` / `virtualRateCents` / `inHomeRateCents`
 *      hourly fields, scaled proportionally to the requested duration.
 *   4. `ratePerMinuteCents` × duration  — legacy per-minute schema.
 *   5. null  — caller must show a "Rates not set" placeholder.
 *
 * EVERY rate UI surface must funnel through this so the same trainer profile
 * never shows three different prices for the same session.
 */

export type Modality = 'outdoor' | 'in_home' | 'virtual';
export type Duration = 30 | 45 | 60 | 90;

interface TrainerLike {
  tierRates?: Record<string, number | undefined> | null;
  outdoorRateCents?: number | null;
  inHomeRateCents?: number | null;
  virtualRateCents?: number | null;
  ratePerMinuteCents?: number | null;
  [k: string]: any;
}

/**
 * Resolve the session price for a trainer + modality + duration combo.
 * Returns the price in cents, or null if the trainer hasn't set any rates yet.
 */
export function resolveSessionPriceCents(
  trainer: TrainerLike | null | undefined,
  modality: Modality,
  duration: Duration,
): number | null {
  if (!trainer) return null;

  // The frontend collapses "outdoor" and "in_home" into the same "inPerson"
  // prefix on the tierRates object. Virtual stays its own modality.
  const tierKey = modality === 'virtual' ? 'virtual' : 'inPerson';

  // 1. Preferred — explicit per-duration price.
  const tier = trainer.tierRates as Record<string, number | undefined> | undefined;
  const tierCents = tier?.[`${tierKey}${duration}Cents`];
  if (typeof tierCents === 'number' && tierCents > 0) return tierCents;

  // 2. Flat alias on the doc itself (some older docs stored them at the top).
  const flatCents = (trainer as any)[`${tierKey}${duration}Cents`];
  if (typeof flatCents === 'number' && flatCents > 0) return flatCents;

  // 3. Hourly field scaled by duration / 60.
  //    Note: backend stores the trainer's TAKE-HOME (80%), so we gross up
  //    by /0.80 to get the trainee-facing session price. Matches the
  //    existing logic in trainer-detail.tsx so this resolver is a drop-in
  //    replacement.
  const hourlyMap: Record<Modality, number | null | undefined> = {
    virtual: trainer.virtualRateCents,
    in_home: trainer.inHomeRateCents,
    outdoor: trainer.outdoorRateCents,
  };
  const hourly = hourlyMap[modality];
  if (typeof hourly === 'number' && hourly > 0) {
    const fullHourly = Math.round(hourly / 0.80);
    return Math.round(fullHourly * (duration / 60));
  }

  // 4. Legacy per-minute schema.
  if (typeof trainer.ratePerMinuteCents === 'number' && trainer.ratePerMinuteCents > 0) {
    return trainer.ratePerMinuteCents * duration;
  }

  // 5. No rates at all.
  return null;
}

/**
 * Convenience wrapper: returns a display-ready string ("$50.00", or "—").
 * Pass `dashOnNull=false` to get `""` instead, useful in inputs.
 */
export function formatSessionPrice(
  trainer: TrainerLike | null | undefined,
  modality: Modality,
  duration: Duration,
  dashOnNull: boolean = true,
): string {
  const cents = resolveSessionPriceCents(trainer, modality, duration);
  if (cents === null) return dashOnNull ? '—' : '';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Sanity helper for the profile-rate badge — finds the lowest available
 * priced duration so the badge says something honest like "from $30 / 30 min"
 * instead of a hardcoded value.
 */
export function lowestPricedDuration(
  trainer: TrainerLike | null | undefined,
  modality: Modality = 'outdoor',
): { duration: Duration; cents: number } | null {
  const durations: Duration[] = [30, 45, 60, 90];
  let best: { duration: Duration; cents: number } | null = null;
  for (const d of durations) {
    const c = resolveSessionPriceCents(trainer, modality, d);
    if (c !== null && (best === null || c < best.cents)) {
      best = { duration: d, cents: c };
    }
  }
  return best;
}
