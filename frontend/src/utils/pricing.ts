/**
 * RapidReps Tier Pricing — frontend mirror of `backend/services/pricing_tiers.py`.
 *
 * Use this for instant client-side display (no API call needed). For authoritative
 * quotes (e.g., during booking confirmation), call `GET /api/pricing/quote`.
 *
 * All money values are CENTS (number). Convert at the display boundary only.
 */

export type TrainerTier = 'new' | 'certified' | 'specialty';
export type Modality = 'in_person' | 'virtual';
export type Duration = 30 | 60 | 90;

export interface TierConfig {
  label: string;
  commission_percent: number;
  trainer_percent: number;
  in_person: {
    service_fee_cents: number;
    rate_caps_cents: Record<Duration, number>;
  };
  virtual: {
    service_fee_cents: number;
    rate_caps_cents: Record<Duration, number>;
  };
}

export interface PricingBreakdown {
  tier: TrainerTier;
  tier_label: string;
  modality: Modality;
  duration_min: Duration;
  base_price_cents: number;
  trainer_take_home_cents: number;
  commission_cents: number;
  service_fee_cents: number;
  customer_total_cents: number;
  rapidreps_total_cents: number;
  commission_percent: number;
  trainer_percent: number;
}

export const TIER_MATRIX: Record<TrainerTier, TierConfig> = {
  new: {
    label: 'New Trainer',
    commission_percent: 25,
    trainer_percent: 75,
    in_person: {
      service_fee_cents: 499,
      rate_caps_cents: { 30: 3500, 60: 6500, 90: 9500 },
    },
    virtual: {
      service_fee_cents: 399,
      rate_caps_cents: { 30: 3000, 60: 5500, 90: 8000 },
    },
  },
  certified: {
    label: 'Certified Trainer',
    commission_percent: 20,
    trainer_percent: 80,
    in_person: {
      service_fee_cents: 599,
      rate_caps_cents: { 30: 5000, 60: 9000, 90: 13000 },
    },
    virtual: {
      service_fee_cents: 499,
      rate_caps_cents: { 30: 4500, 60: 8000, 90: 11500 },
    },
  },
  specialty: {
    label: 'Specialty Trainer',
    commission_percent: 15,
    trainer_percent: 85,
    in_person: {
      service_fee_cents: 799,
      rate_caps_cents: { 30: 7500, 60: 14000, 90: 20000 },
    },
    virtual: {
      service_fee_cents: 599,
      rate_caps_cents: { 30: 6500, 60: 12000, 90: 17500 },
    },
  },
};

export const TIER_ORDER: TrainerTier[] = ['new', 'certified', 'specialty'];

export function getRateCapCents(
  tier: TrainerTier,
  modality: Modality,
  duration: Duration,
): number {
  return TIER_MATRIX[tier][modality].rate_caps_cents[duration];
}

export function getServiceFeeCents(tier: TrainerTier, modality: Modality): number {
  return TIER_MATRIX[tier][modality].service_fee_cents;
}

export function calculatePricing(
  tier: TrainerTier,
  modality: Modality,
  duration: Duration,
  trainerBaseCents: number,
): PricingBreakdown {
  const cfg = TIER_MATRIX[tier];
  const commissionPercent = cfg.commission_percent;
  const serviceFeeCents = cfg[modality].service_fee_cents;
  const commissionCents = Math.round((trainerBaseCents * commissionPercent) / 100);
  const trainerTakeHomeCents = trainerBaseCents - commissionCents;
  const customerTotalCents = trainerBaseCents + serviceFeeCents;
  const rapidrepsTotalCents = commissionCents + serviceFeeCents;
  return {
    tier,
    tier_label: cfg.label,
    modality,
    duration_min: duration,
    base_price_cents: trainerBaseCents,
    trainer_take_home_cents: trainerTakeHomeCents,
    commission_cents: commissionCents,
    service_fee_cents: serviceFeeCents,
    customer_total_cents: customerTotalCents,
    rapidreps_total_cents: rapidrepsTotalCents,
    commission_percent: commissionPercent,
    trainer_percent: cfg.trainer_percent,
  };
}

export function validateRateCents(
  tier: TrainerTier,
  modality: Modality,
  duration: Duration,
  baseCents: number,
): { ok: boolean; error?: string } {
  if (!Number.isFinite(baseCents) || baseCents < 0) {
    return { ok: false, error: 'Rate must be a non-negative number.' };
  }
  const cap = getRateCapCents(tier, modality, duration);
  if (baseCents > cap) {
    return {
      ok: false,
      error: `Rate $${(baseCents / 100).toFixed(2)} exceeds tier cap of $${(cap / 100).toFixed(2)}.`,
    };
  }
  return { ok: true };
}

/** "$72.50" — never raw cents in the UI. */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

/** "Certified · 60 min" */
export function describeTierSession(tier: TrainerTier, duration: Duration): string {
  return `${TIER_MATRIX[tier].label} · ${duration} min`;
}
