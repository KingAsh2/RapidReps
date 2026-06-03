/**
 * Welcome Variant B — Community-first hero (iter95 A/B harness).
 *
 * This is the alternate Welcome experience surfaced when
 *   EXPO_PUBLIC_WELCOME_VARIANT === 'B'
 *
 * Goal: same brand DNA as Variant A but lead with the community angle
 * ("TRAINERS NEAR YOU") rather than the delivery promise
 * ("DELIVERED RAPIDLY"). For now we re-export the premium screen so the
 * harness is fully wired; design can override `index.premium-b.tsx`
 * independently without touching the routing.
 */
import PremiumWelcome from './index.premium';

export default PremiumWelcome;
