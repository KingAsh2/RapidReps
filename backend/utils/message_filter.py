"""
iter118be — Contact-Info Filter for In-App Messaging.

Purpose: reduce off-platform circumvention by refusing chat messages that
try to share phone numbers, emails, external social handles, or explicit
"take it off the app" phrasing. Every hit is logged to `chat_flags`.

Design notes
- Server-side only; the client never sees the regex list.
- First hit → refuse + warn. We do NOT auto-suspend on first flag; the
  admin panel surfaces repeat offenders (see routes/admin_routes.py
  `/admin/repeat-pairing-flags` in iter118be).
- We return the *type* of thing that was matched so the UX can be
  slightly more helpful ("Looks like a phone number — please keep it
  in the app") while never revealing what pattern actually fired.
"""
from __future__ import annotations
import re
from typing import Optional

# --- Regex catalog ----------------------------------------------------------
# All patterns are IGNORECASE and use word boundaries where sensible.

# US phone numbers: 3-3-4 (dashes / dots / spaces / parens), optional +1,
# and letter-substitutions like "five five five" are NOT covered — we accept
# the false-negative rather than false-positive on the word 'five'.
_RE_PHONE = re.compile(
    r"""(?ix)
    (?:\+?1[\s.\-]?)?               # optional country code
    \(?[\d][\d\s.\-]{1,4}\)?        # 3 digits with allowed separators
    [\s.\-]?[\d][\d\s.\-]{2,5}      # 3+ digits
    [\s.\-]?[\d]{3,4}               # last 3-4 digits
    """,
    re.VERBOSE,
)
# Stricter phone: at least 10 digits total, avoids matching prices like $12.99
_RE_PHONE_STRICT = re.compile(r"(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}")

_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+\s*(?:@|\bat\b|\(at\))\s*[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", re.IGNORECASE)

# @handles OR platform mentions with a nearby handle-like token.
_RE_HANDLE_AT = re.compile(r"@[A-Za-z0-9_.\-]{2,}")
_RE_SOCIAL_MENTION = re.compile(
    r"\b(instagram|insta|ig|snap(?:chat)?|whats?app|telegram|tik ?tok|discord|kik|signal|imessage)\b",
    re.IGNORECASE,
)

# "take it off platform" / meet up / payment-external phrasing.
_RE_OFF_PLATFORM = re.compile(
    r"\b("
    r"off\s+(?:the\s+)?app|off[-\s]?platform|outside\s+the\s+app|off\s+rapidreps|"
    r"text\s+me|call\s+me|dm\s+me|reach\s+me\s+at|hit\s+me\s+up|"
    r"pay\s+(?:me\s+)?(?:in\s+)?cash|cash\s+app|cash[-\s]?app|"
    r"venmo|zelle|paypal|cashapp|apple\s?pay|google\s?pay|"
    r"side\s+deal|book\s+direct|book\s+direct(?:ly)?|"
    r"skip\s+the\s+app|skip\s+rapidreps"
    r")\b",
    re.IGNORECASE,
)


def _has_min_digits(s: str, minimum: int = 10) -> bool:
    return sum(1 for c in s if c.isdigit()) >= minimum


def check_message(text: str) -> Optional[dict]:
    """
    Inspect `text` for contact-info sharing / off-platform routing.

    Returns None if clean.
    Returns a dict {flagType, matched} if the message should be blocked.
    We never surface `matched` to the sender — it's for the chat_flags log.
    """
    if not text or not isinstance(text, str):
        return None

    s = text.strip()

    # Phone — require strict form OR loose form with ≥10 digits total.
    m = _RE_PHONE_STRICT.search(s)
    if m:
        return {"flagType": "phone", "matched": m.group(0)}
    if _has_min_digits(s, 10):
        m = _RE_PHONE.search(s)
        if m and _has_min_digits(m.group(0), 10):
            return {"flagType": "phone", "matched": m.group(0)}

    # Email — including obfuscations like "name at gmail dot com"
    m = _RE_EMAIL.search(s)
    if m:
        return {"flagType": "email", "matched": m.group(0)}
    # explicit "dot com" split
    if re.search(r"\b[A-Za-z0-9_.\-]+\s+(?:@|at)\s+[A-Za-z0-9_.\-]+\s+(?:dot|\.)\s+(?:com|net|org|io|co)\b", s, re.IGNORECASE):
        return {"flagType": "email", "matched": "obfuscated-email"}

    # Social handle (@user) — always block; harmless business talk rarely
    # needs a leading-@ token in a training-session chat.
    m = _RE_HANDLE_AT.search(s)
    if m:
        return {"flagType": "handle", "matched": m.group(0)}

    # Platform mentions — block only if accompanied by a hint they're
    # sharing an identity (username-ish token, or the off-platform phrasing).
    if _RE_SOCIAL_MENTION.search(s):
        # e.g. "my Instagram is skyworkout" — 2nd token often a handle
        if re.search(r"\b(is|:|handle|username|user\s*name)\b\s+\S{3,}", s, re.IGNORECASE):
            return {"flagType": "social_share", "matched": _RE_SOCIAL_MENTION.search(s).group(0)}

    # Off-platform / payment phrasing
    m = _RE_OFF_PLATFORM.search(s)
    if m:
        return {"flagType": "off_platform", "matched": m.group(0)}

    return None


def user_facing_reason(flag_type: str) -> str:
    """Short, helpful sender-facing copy — never reveal the regex."""
    return {
        "phone": "Looks like a phone number.",
        "email": "Looks like an email address.",
        "handle": "Looks like a social handle.",
        "social_share": "Looks like you're sharing a social account.",
        "off_platform": "This looks like it moves the booking outside RapidReps.",
    }.get(flag_type, "That looks like off-platform contact info.")
