# RapidReps Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Seeded Sample Trainers (iter118i — Elkridge/Laurel/College Park/Hanover MD corridor)

All 5 trainers below are admin-approved, verified, tier-assigned, and Available.
They surface in the trainee `/api/trainers/nearby` endpoint from any location in the MD corridor.

| Trainer | City | Coords | Password |
|---------|------|--------|----------|
| Marcus Reyes (Elite) | Elkridge, MD | 39.2126, -76.7130 | SamplePass!2025 |
| Devon Malik (Elite) | Elkridge, MD | 39.2148, -76.7069 | SamplePass!2025 |
| Sara Nguyen (Pro) | Hanover, MD | 39.1920, -76.7237 | SamplePass!2025 |
| Jasmine Carter (Pro) | Laurel, MD | 39.0993, -76.8483 | SamplePass!2025 |
| Andre Thompson (Elite) | College Park, MD | 38.9807, -76.9369 | SamplePass!2025 |

Sample trainer emails: `<firstname>.<city>@rapidreps-seed.com`
(e.g. `marcus.elkridge@rapidreps-seed.com`)

Seed script (idempotent, safe to rerun):
```
cd /app/backend && python -m scripts.seed_sample_trainers
```
