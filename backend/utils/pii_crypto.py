"""PII encryption helpers.

Used for at-rest encryption of highly sensitive PII fields (e.g., SSN) that
must remain reversible for authorized admin review (e.g., background check
submission to TruthFinder) but must NEVER be stored as plaintext in MongoDB.

Uses symmetric Fernet (AES-128-CBC + HMAC-SHA256) with the key sourced from
PII_ENCRYPTION_KEY in backend/.env. If the key is missing, encryption/decryption
will fail loudly rather than silently downgrade to plaintext.
"""
import os
from cryptography.fernet import Fernet, InvalidToken


def _get_cipher() -> Fernet:
    key = os.environ.get('PII_ENCRYPTION_KEY')
    if not key:
        raise RuntimeError(
            "PII_ENCRYPTION_KEY missing from backend/.env — refusing to handle PII."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_ssn(ssn: str) -> str:
    """Encrypt a raw SSN (9 digits, no dashes) into a Fernet token string."""
    if not ssn:
        return ''
    digits = ''.join(ch for ch in ssn if ch.isdigit())
    if not digits:
        return ''
    return _get_cipher().encrypt(digits.encode()).decode()


def decrypt_ssn(token: str) -> str:
    """Decrypt a Fernet-encrypted SSN token. Returns '' on failure."""
    if not token:
        return ''
    try:
        return _get_cipher().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return ''


def ssn_last4(ssn: str) -> str:
    """Return the last 4 digits of an SSN for identification. Safe to store."""
    if not ssn:
        return ''
    digits = ''.join(ch for ch in ssn if ch.isdigit())
    return digits[-4:] if len(digits) >= 4 else ''


def mask_ssn(ssn: str) -> str:
    """Return a masked display string like '***-**-1234'."""
    last4 = ssn_last4(ssn)
    return f'***-**-{last4}' if last4 else ''
