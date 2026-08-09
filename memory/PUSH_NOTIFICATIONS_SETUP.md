# RapidReps — Push Notifications Production Setup

**Status:** Code side is 100% wired. Only credential handoff remains.
**Bundle:** `app.emergent.trainerfinder9f806c77e`
**Apple Team:** `38NPTUJ6P2` (from eas.json)
**Apple ID:** `ashtonbundy1@gmail.com` (from eas.json)
**EAS project:** `rapidreps`

---

## Step 1 — Install/verify EAS CLI on your machine

```bash
npm install -g eas-cli
cd /path/to/your/rapidreps/frontend
eas login          # use the account that owns the "rapidreps" project
eas whoami         # confirm
eas project:info   # verify project id
```

---

## Step 2 — iOS APNs push key (managed by EAS)

Run from `/frontend`:

```bash
eas credentials
```

Then select:
1. **iOS**
2. **production**
3. **Push Notifications: Manage your Apple Push Notifications Key**
4. **Set up a new Apple Push Notifications Key**
5. EAS will prompt for your Apple ID → enter `ashtonbundy1@gmail.com`
6. Apple will send a **2FA code to your trusted device** — enter it
7. EAS auto-generates the `.p8` key, uploads it to Expo, links to Team `38NPTUJ6P2`
8. Confirm "Yes" when it asks to use this key going forward

Done. iOS push credentials are live.

---

## Step 3 — Firebase project for Android (FCM)

### 3a. Create/verify Firebase project

1. Go to https://console.firebase.google.com
2. Sign in with your Google account
3. Click **Add project** → name it `RapidReps` (or reuse an existing one)
4. Disable Google Analytics (optional; not needed for push)
5. Once created, click the **Android** icon on the project home
6. **Android package name:** `app.emergent.trainerfinder9f806c77e` (exact match required)
7. App nickname: `RapidReps`
8. SHA-1: skip for now (can add later)
9. Click **Register app**

### 3b. Download `google-services.json`

10. Download the `google-services.json` Firebase gives you
11. Place it at **`/app/frontend/google-services.json`** (repo path already referenced in `app.json`)
12. Click **Next → Next → Continue to console**

### 3c. Generate the FCM V1 service-account key

13. In Firebase Console → click ⚙️ (gear icon) → **Project settings**
14. Go to **Service accounts** tab
15. Click **Generate new private key** → **Generate key**
16. A JSON file downloads — this is the FCM V1 service-account key
17. **⚠️ DO NOT COMMIT THIS FILE.** Save it somewhere secure. `.gitignore` already covers `*service-account*.json` patterns — verify with `git check-ignore <filename>`.

### 3d. Upload the service-account key to EAS

```bash
eas credentials
```

Then select:
1. **Android**
2. **production**
3. **Google Service Account**
4. **Manage your Google Service Account Key for Push Notifications (FCM V1)**
5. **Upload a new service account key**
6. Provide the path to the JSON you downloaded in step 3c

Done. Android FCM credentials are live.

---

## Step 4 — Rebuild production binaries

```bash
cd /path/to/your/rapidreps/frontend
eas build --platform ios --profile production
eas build --platform android --profile production
```

Each build takes ~15–30 minutes on EAS servers. When done:
- iOS build auto-submits to TestFlight (via `eas.json` submit config), or run `eas submit --platform ios --profile production` manually
- Android build produces an `.aab` you can upload to Play Console internal testing (or `eas submit --platform android --profile production` if the service-account has Play Publishing rights too)

---

## Step 5 — Verify pushes work in production

1. Install the new TestFlight / Play internal-testing build on a real device
2. Open the app once, grant notification permission
3. Log in → the app registers a fresh `ExponentPushToken[...]`
4. Force-quit the app (swipe away from app switcher)
5. Trigger any push from your admin panel or via curl:

```bash
API_URL=$(grep EXPO_PUBLIC_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
# admin token needed — replace TOKEN with your admin JWT
curl -X POST "$API_URL/api/admin/broadcast" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prod test","body":"Background delivery works","userIds":["YOUR_USER_ID"]}'
```

6. Push should appear in the device notification center within 1–3 seconds

---

## Common gotchas (in order of likelihood)

1. **`MismatchSenderId`** — the `google-services.json` in the repo and the service-account you uploaded belong to different Firebase projects. Redo Step 3 using the same project for both files.
2. **iOS pushes silent** — old TestFlight build cached; make sure the device installed the **new build** after credential setup.
3. **Android POST_NOTIFICATIONS permission** — already declared in `app.json`; on Android 13+ the app must prompt once at runtime (already handled by NotificationContext.tsx).
4. **Force-quit on Android** — if the user swipes the app away from recents (rare), Android may block pushes until they reopen once. This is Android OS behavior, not fixable in code.
5. **Firebase package name mismatch** — must be **exactly** `app.emergent.trainerfinder9f806c77e`. Any typo = pushes never register.

---

## What's already handled (no action needed)

- ✅ `expo-notifications` installed + plugin configured
- ✅ `enableBackgroundRemoteNotifications: true` set in app.json plugin config
- ✅ `POST_NOTIFICATIONS` Android permission declared
- ✅ `googleServicesFile: "./google-services.json"` referenced in app.json
- ✅ Foreground handler (`setNotificationHandler`)
- ✅ Android channel creation (`default` channel, MAX importance)
- ✅ Push token registration → `/api/push-tokens/register`
- ✅ Backend `send_push_notification()` posts to Expo push service with `priority: "high"` and `channelId: "default"`
- ✅ Notification tap handler routes into the app
- ✅ Dead-token cleanup (2-strike DeviceNotRegistered removal in deps.py)

---

## When you're stuck

Paste the exact terminal error into chat and I'll debug it. Most common issues are 2FA loops (retry after 30s) or Firebase package-name typos.
