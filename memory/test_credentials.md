# Test Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Social Auth Notes
- **Apple Sign-In**: Works on iOS devices only (uses native `expo-apple-authentication`)
- **Google Sign-In**: Uses Emergent Auth (`WebBrowser.openAuthSessionAsync` → `auth.emergentagent.com`)
- **Facebook Login**: Scaffolded (UI ready), requires `FACEBOOK_APP_ID` env var on backend to activate
