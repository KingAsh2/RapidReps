"""
iter118k — Direct push notification providers (FCM + APNs) that bypass Expo Push Service.

Why this exists:
Expo Push Service is convenient (single POST to exp.host handles both APNs+FCM)
BUT it requires our FCM service-account key + APNs .p8 key uploaded to Expo's
credential store via `eas credentials`. That upload requires an interactive
Expo login which we don't have here.

Workaround: we own both credentials locally, so we send DIRECTLY to Google
FCM V1 and Apple APNs. Expo Push Service falls back for legacy ExponentPushToken
registrations (dev builds).

Routing (in deps.send_push_notification):
  tokenType == 'expo' → POST https://exp.host/--/api/v2/push/send    (dev/Expo Go)
  tokenType == 'fcm'  → firebase-admin messaging.send()              (Android prod)
  tokenType == 'apns' → aioapns direct APNs push                     (iOS prod)

Credentials:
  /app/backend/credentials/firebase-service-account.json — FCM V1 service account
  /app/backend/credentials/apns-key.p8                    — APNs auth key
  Key ID / Team ID / Bundle ID come from constants below (from user's Apple + EAS setup)
"""
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
CREDENTIALS_DIR = BASE_DIR / 'credentials'

FIREBASE_SERVICE_ACCOUNT_PATH = str(CREDENTIALS_DIR / 'firebase-service-account.json')
APNS_KEY_PATH = str(CREDENTIALS_DIR / 'apns-key.p8')

# APNs identifiers — pulled from the leaked upload filename + eas.json + app.json
APNS_KEY_ID = os.environ.get('APNS_KEY_ID', 'AW9VZJC7TF')
APNS_TEAM_ID = os.environ.get('APNS_TEAM_ID', '38NPTUJ6P2')
APNS_BUNDLE_ID = os.environ.get('APNS_BUNDLE_ID', 'app.emergent.trainerfinder9f806c77e')
APNS_USE_SANDBOX = os.environ.get('APNS_USE_SANDBOX', 'false').lower() == 'true'


def _load_apns_key_pem() -> Optional[str]:
    """Read the .p8 file into a PEM string (aioapns passes this to PyJWT which
    needs actual PEM bytes, not a file path)."""
    if not os.path.exists(APNS_KEY_PATH):
        return None
    try:
        with open(APNS_KEY_PATH, 'r') as f:
            return f.read()
    except Exception as e:
        logger.warning(f"Failed to read APNs key: {e}")
        return None


# ---- FCM V1 ----------------------------------------------------------------
_firebase_app = None


def _get_firebase_app():
    """Lazy-init firebase-admin the first time we need to send an FCM push."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if not os.path.exists(FIREBASE_SERVICE_ACCOUNT_PATH):
        logger.warning(f"FCM credential missing at {FIREBASE_SERVICE_ACCOUNT_PATH}")
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
        _firebase_app = firebase_admin.initialize_app(cred, name='rapidreps-push')
        logger.info("firebase-admin initialized for FCM V1 push")
        return _firebase_app
    except ValueError:
        # Already initialized (test/hot-reload)
        import firebase_admin
        _firebase_app = firebase_admin.get_app('rapidreps-push')
        return _firebase_app
    except Exception as e:
        logger.warning(f"Failed to init firebase-admin: {e}")
        return None


def send_fcm_v1(token: str, title: str, body: str, data: Optional[dict], badge: int) -> tuple[bool, Optional[str]]:
    """Send a single FCM V1 push. Returns (ok, error_code).
    error_code == 'INVALID_TOKEN' or 'UNREGISTERED' → dead token, caller should evict."""
    app = _get_firebase_app()
    if app is None:
        return False, 'NO_CREDENTIAL'
    try:
        from firebase_admin import messaging
        msg = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    channel_id='default',
                    sound='default',
                    default_sound=True,
                    default_vibrate_timings=True,
                    notification_count=badge if badge >= 0 else None,
                ),
            ),
            # Data must be str→str for FCM
            data={k: str(v) for k, v in (data or {}).items()},
        )
        resp = messaging.send(msg, app=app)
        logger.info(f"FCM sent → {resp}")
        return True, None
    except Exception as e:
        err = str(e)
        # firebase-admin raises different subclasses; check by error code
        code = getattr(getattr(e, 'code', None), 'value', None) or ''
        if 'UNREGISTERED' in err or 'INVALID_ARGUMENT' in err or 'NOT_FOUND' in err or 'registration-token-not-registered' in err.lower():
            logger.info(f"FCM dead token: {token[:16]}… ({err[:100]})")
            return False, 'UNREGISTERED'
        logger.warning(f"FCM send failed: {err[:200]}")
        return False, err[:80]


# ---- APNs -------------------------------------------------------------------
_apns_client = None


def _get_apns_client():
    global _apns_client
    if _apns_client is not None:
        return _apns_client
    if not os.path.exists(APNS_KEY_PATH):
        logger.warning(f"APNs key missing at {APNS_KEY_PATH}")
        return None
    try:
        from aioapns import APNs
        _apns_client = APNs(
            key=APNS_KEY_PATH,
            key_id=APNS_KEY_ID,
            team_id=APNS_TEAM_ID,
            topic=APNS_BUNDLE_ID,
            use_sandbox=APNS_USE_SANDBOX,
        )
        logger.info(
            f"APNs client initialized (bundle={APNS_BUNDLE_ID}, sandbox={APNS_USE_SANDBOX})"
        )
        return _apns_client
    except Exception as e:
        logger.warning(f"Failed to init APNs client: {e}")
        return None


async def send_apns(token: str, title: str, body: str, data: Optional[dict], badge: int) -> tuple[bool, Optional[str]]:
    """Send a single APNs push. Returns (ok, error_code).
    We instantiate the aioapns client per-call so it always binds to the current
    running event loop (aioapns caches HTTP/2 connections internally per client)."""
    pem = _load_apns_key_pem()
    if pem is None:
        logger.warning(f"APNs key missing at {APNS_KEY_PATH}")
        return False, 'NO_CREDENTIAL'
    try:
        from aioapns import APNs, NotificationRequest, PushType
        client = APNs(
            key=pem,
            key_id=APNS_KEY_ID,
            team_id=APNS_TEAM_ID,
            topic=APNS_BUNDLE_ID,
            use_sandbox=APNS_USE_SANDBOX,
        )
        alert_payload = {
            'aps': {
                'alert': {'title': title, 'body': body},
                'sound': 'default',
                'badge': badge if badge >= 0 else 0,
                'mutable-content': 1,
            },
        }
        if data:
            for k, v in data.items():
                alert_payload[k] = v
        req = NotificationRequest(
            device_token=token,
            message=alert_payload,
            push_type=PushType.ALERT,
            priority=10,
        )
        resp = await client.send_notification(req)
        if getattr(resp, 'is_successful', False):
            logger.info(f"APNs sent → {token[:12]}… status={resp.status}")
            return True, None
        status = getattr(resp, 'status', 'unknown')
        desc = getattr(resp, 'description', '') or ''
        if status in ('BadDeviceToken', 'Unregistered') or 'BadDeviceToken' in desc or 'Unregistered' in desc:
            return False, 'UNREGISTERED'
        logger.warning(f"APNs send failed: status={status} desc={desc}")
        return False, str(status)
    except Exception as e:
        err = str(e)
        logger.warning(f"APNs exception: {err[:200]}")
        return False, err[:80]
