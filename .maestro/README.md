# RapidReps Maestro E2E Tests

End-to-end smoke tests covering the critical money-touching flows:
**login → book → pay → payout**. These run against a real device/simulator
and exercise the actual UI — they're the last line of defense before
shipping.

## Setup

```bash
# macOS
brew install --no-quarantine mobiledevicemanagement/tap/maestro

# Linux / CI
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Run

```bash
# Run all flows against the currently connected device / sim
cd /app
maestro test .maestro/

# Run a single flow
maestro test .maestro/01_login_trainee.yaml

# Record a flow visually (useful when adding new ones)
maestro studio
```

Maestro auto-detects whether your device runs Expo Go, an internal-distribution
build, or the production build by the `appId` declared at the top of each flow.

## Flow inventory

| Order | File | Covers |
|------|------|--------|
| 01 | `01_login_trainee.yaml` | Trainee email/password login |
| 02 | `02_login_trainer.yaml` | Trainer email/password login |
| 03 | `03_book_session.yaml`  | Trainee creates a session + sends to trainer |
| 04 | `04_trainer_accept.yaml`| Trainer accepts the session (triggers one-tap pay push) |
| 05 | `05_trainee_pay.yaml`   | Trainee opens the deep-linked payment screen and pays |
| 06 | `06_trainer_payout_info.yaml` | Trainer fills out Zelle/Venmo handle so admin can pay them |

## Test credentials (already seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin   | admin@rapidreps.com               | admin123 |
| Trainee | test_trainee_iter25@test.com      | Test123! |
| Trainer | test_trainer_iter25@test.com      | Test123! |

## CI integration (optional)

Add the following step to your EAS / GitHub Actions pipeline:

```yaml
- name: Maestro E2E
  run: |
    curl -Ls "https://get.maestro.mobile.dev" | bash
    export PATH="$PATH":"$HOME/.maestro/bin"
    maestro test .maestro/ --format junit --output /tmp/maestro.xml
```

## Why these flows?

Each one represents real money risk:
- **Login** failures lock out paying customers.
- **Book** is the entry to the funnel; broken booking = zero revenue.
- **Pay** is where Stripe gets called. Any regression here is critical.
- **Payout** is how trainers get paid — broken handles = unhappy trainers.

If all 6 flows pass on a release-channel build, the app is shippable.
