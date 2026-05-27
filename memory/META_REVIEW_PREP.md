# Meta App Review Prep — RapidReps Instagram Integration

> **Audience**: Submitter (Ashton) + Meta App Review reviewer
> **Last updated**: 2026-05-27

## 1. What permission we're requesting

| Permission | Why we need it |
|---|---|
| `instagram_business_basic` | To read the most recent 8 media items of a linked user and display them on their RapidReps profile so trainers and trainees can get a sense of each other's training style and lifestyle (similar to how Tinder shows Instagram posts) |

We do **NOT** request `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_messages` or any other write permissions.

## 2. Where the data is used

- A **"Instagram"** section appears on the user's RapidReps profile (both the trainee and trainer side).
- Only the **user-curated subset** of their last 8 IG posts are publicly visible to other RapidReps users viewing that profile.
- The user can refresh, re-curate, or fully unlink at any time.

## 3. Data handling

- Access tokens are **AES-GCM encrypted at rest** in MongoDB (we never store plaintext tokens).
- Token encryption key (`INSTAGRAM_TOKEN_ENC_KEY`) is environment-only and rotated quarterly.
- Cached media URLs/thumbnails are read-only references — we do not download media files to our servers.
- On unlink: the link doc is **hard-deleted** (no soft-delete or retention).
- On Meta-initiated deauthorize webhook: same hard-delete.
- On Meta-initiated data-deletion webhook: same hard-delete + we return a confirmation URL per Meta spec.

## 4. Required reviewer screencast (record once keys arrive)

**Length**: 60–90 seconds. Record on a real iPhone.

| Time | Action | What reviewer sees |
|---|---|---|
| 0:00 | Open RapidReps, sign in as a trainee with a Business IG account on file | Home → Profile tab |
| 0:08 | Scroll to "Instagram" card → tap **Link Instagram** | OAuth dialog opens |
| 0:15 | Sign in to Instagram, grant permission | Returns to RapidReps |
| 0:25 | App routes to **"Pick what shows"** curator screen | 8 IG thumbnails in 3-col grid with checkmarks |
| 0:32 | Tap several thumbnails to toggle on/off → tap **Save** | Counter updates; success toast |
| 0:40 | Navigate back to profile | Only the 5 selected posts are visible in 4-col grid |
| 0:50 | Tap the refresh icon → see new sync toast | Latest posts pulled |
| 0:58 | Tap the unlink icon → confirm | Section returns to "Link Instagram" empty state |

## 5. Privacy Policy URL

Public URL: **https://trainer-finder-9.emergent.host/api/privacy/policy**

Reviewer-relevant snippet (already drafted at `/app/backend/static/privacy-policy.html` — see Section 4 "Instagram Integration").

## 6. Deauth & Data Deletion URLs

Both reachable via HTTPS, verified responding `200 OK`:
- **Deauthorize Callback URL**: `https://trainer-finder-9.emergent.host/api/instagram/deauthorize`
- **Data Deletion Request URL**: `https://trainer-finder-9.emergent.host/api/instagram/data-deletion`

## 7. Test credentials for Meta reviewer

Provide in the App Review submission "Notes" field:

```
Test trainee account:
  Email: test_trainee_iter25@test.com
  Password: Test123!

To reach the Instagram link screen:
  1. Log in
  2. Go to Profile tab (bottom right)
  3. Scroll to the "Instagram" card and tap "Link Instagram"

(Reviewer's own IG Creator/Business test account works — we accept all valid Business/Creator accounts.)
```

## 8. Going-live checklist

- [ ] Facebook App ID pasted into `frontend/.env`
- [ ] Instagram App ID pasted into `backend/.env` (`INSTAGRAM_APP_ID`)
- [ ] Instagram App Secret pasted into `backend/.env` (`INSTAGRAM_APP_SECRET`)
- [ ] Redirect URI `rapidreps://instagram-callback` whitelisted in Meta Dashboard
- [ ] Deauthorize Callback URL configured + verified
- [ ] Data Deletion Request URL configured + verified
- [ ] Privacy Policy URL set in Meta Dashboard → App Settings → Basic
- [ ] App icon (1024×1024) uploaded
- [ ] Category set to "Health & Fitness"
- [ ] Recorded screencast (per Section 4)
- [ ] App Review submitted for `instagram_business_basic`
- [ ] After approval: flip Meta Dashboard mode from **Development** → **Live**
