# EAS Push Notifications Setup — RapidReps

This guide finishes wiring production push notifications (APNs for iOS + FCM
for Android) through EAS. The codebase is already configured (`expo-notifications`
plugin, manifest permissions, app.json references). You only need to upload the
credentials EAS asks for.

> **Status snapshot** — done in the codebase:
> - `expo-notifications` plugin registered in `app.json` with brand color + icon
> - `POST_NOTIFICATIONS` Android permission added
> - `useNextNotificationsApi: true` set on Android (modern FCM v1 path)
> - `googleServicesFile` reference added (Android)
> - `submit.production` config scaffolded in `eas.json` for both platforms

---

## ① iOS — APNs Auth Key (.p8)

EAS supports two ways to attach APNs. The `.p8` Auth Key is the **modern, recommended**
path (one key powers prod + sandbox + multiple bundle IDs).

**Prereqs from your Apple Developer account:**
- Apple Team ID (10-char, e.g. `ABCDE12345`)
- An APNs Auth Key created at https://developer.apple.com/account/resources/authkeys/list
  - Key ID (10-char, e.g. `ABC123DEFG`)
  - Downloaded `.p8` file (you can only download this ONCE — keep it safe)

**Upload to EAS** (run from `/app/frontend`):

```bash
eas login
eas credentials --platform ios
# → choose "Push Notifications: Manage your Apple Push Notifications Key"
# → "Set up a new push key"
# → paste Key ID, Team ID, and the path to your downloaded .p8 file
```

Verify it stuck:

```bash
eas credentials --platform ios
# Look for: "✔ Push Key (Key ID: …) is set up"
```

That's it for iOS — the next `eas build -p ios --profile production` will sign with it.

---

## ② Android — Firebase / FCM

Two files are required:

### A) `google-services.json` (build-time)
1. Go to https://console.firebase.google.com → your RapidReps project → ⚙ Project settings → **Your apps** → **Android app**.
2. Click **google-services.json** to download.
3. Drop it at `/app/frontend/google-services.json` (already in `.gitignore` — don't commit it).

The app.json already references this path:
```json
"android": { "googleServicesFile": "./google-services.json", ... }
```

### B) FCM v1 Server Credentials (runtime — used by Expo's push service)
EAS / Expo's push server needs server credentials to hit FCM on your behalf.

1. Firebase Console → ⚙ Project settings → **Service accounts** tab.
2. Click **Generate new private key** → downloads a `.json`.
3. Upload to EAS:

```bash
cd /app/frontend
eas credentials --platform android
# → choose "Google Service Account: Manage your Google Service Account Key"
# → upload the .json you just downloaded
```

Verify:

```bash
eas credentials --platform android
# Look for: "✔ FCM V1 service account key is set up"
```

---

## ③ (Optional) `eas submit` credentials for store delivery

To enable `eas submit -p ios|android`, fill in the `TODO_*` placeholders in
`/app/frontend/eas.json` under `submit.production`:

- **iOS**: `appleId`, `ascAppId` (the numeric "App ID" from App Store Connect),
  `appleTeamId`
- **Android**: download a Play Console service account key
  (https://play.google.com/console → Setup → API access → "Create new service
  account"), save it as `/app/frontend/google-service-account.json`
  (already `.gitignore`d).

---

## ④ Verifying end-to-end after building

```bash
# Build a production-channel internal-distribution build
eas build -p ios --profile production --no-wait
eas build -p android --profile production --no-wait

# After the build installs on a real device, log in and inspect the Expo push
# token registered server-side:
curl -H "Authorization: Bearer $TOKEN" $API/api/user/me | jq '.expoPushToken'

# Send a manual test push (from your laptop) using the Expo push tool:
curl -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/send \
  -d '{"to":"ExponentPushToken[xxx]","title":"Test","body":"It works!"}'
```

If you see the notification on the device, you're done.

---

## Common issues

| Symptom | Fix |
|---------|-----|
| Push works iOS, not Android | Missing `google-services.json` OR FCM v1 service account not uploaded to EAS |
| Push works Android, not iOS | Wrong Team ID, or push capability not enabled in your provisioning profile → run `eas credentials` again |
| Push works in TestFlight but not production | App still configured with sandbox APNs — confirm `production` build profile used a production APNs key |
| Push delivers to Expo Go but not standalone build | `expo-notifications` plugin not actually picked up — rebuild with `--clear-cache` |

---

## Where this is wired in code

- **Plugin registration**: `app.json` → `expo.plugins[]`
- **Permission requests**: handled by `expo-notifications` automatically on first launch
- **Server-side push send**: `/app/backend/deps.py::create_and_send_notification` → calls Expo push API with the user's `expoPushToken`
- **Token registration on device**: `/app/frontend/src/contexts/NotificationContext.tsx`
