# RapidReps Premium ("Performance Pro") Design Guidelines

**Source of truth:** `/app/design_guidelines.json` — full brief from the design agent.

## Migration status (iter106ax → ongoing)

### ✅ Foundation shipped
- **Fonts loaded** in `app/_layout.tsx`: Instrument Serif (display), Inter Tight (body: 400/500/600/700/900).
- **Tokens**: `/app/frontend/src/theme/ladder.ts` — `LADDER` colors, `LADDER_FONTS`, `LADDER_TYPE` scale, `LADDER_MOTION`.
- **Button primitive**: `/app/frontend/src/components/ladder/LadderButton.tsx` — 4 variants (primary/secondary/ghost/destructive), 3 sizes (sm/md/lg), sharp 8px corners, 250ms press-scale, haptic on primary/destructive.
- **First redesigned screen (POC)**: `app/trainer/kyc.tsx` — editorial serif hero, muted label caps, dashed-border upload tiles, LadderButton primary CTA.

### 🔜 Next phases (per design brief)
1. **Trainee home / discovery** — full-bleed trainer cards, 80vh, snap-scroll, editorial name in Instrument Serif.
2. **Trainer detail** — parallax hero, editorial bio quote, glassmorphic sticky booking bar.
3. **Auth screens** (login/register combo) — massive serif headline, minimal chrome.
4. **Session booking flow** — stepper with tight sans, price breakdown as `stats` type.
5. **Trainer earnings** — big number stats (64px Inter Tight Black), sparkline.
6. **Live session tracking** — glass-morphic HUD, ETA in serif.
7. **Trainer profile edit** — editorial magazine layout for previewing.
8. **Admin panel main dashboard** — data-dense, keep utilitarian sans throughout.

### Rules for the next agent picking this up
- Do **NOT** touch `src/theme.ts` or `src/theme/premium.ts` (legacy tokens still in use).
- Import `LADDER`, `LADDER_TYPE`, `LadderButton` for new work.
- One screen at a time. Full-file rewrite is fine; keep testIDs intact.
- Reserve `LADDER.accentBright` (`#FF3B30`) for destructive actions only — brand orange (`LADDER.accent`) is the primary CTA.
- Zero drop shadows. Depth via `borderSubtle` inner strokes + `bgElevated`.
- No emoji as icons — use `Ionicons` or `FontAwesome`.
