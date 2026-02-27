"""
RapidReps Email Service — SendGrid Integration
================================================
Centralized email sending with HTML templates.
Set SENDGRID_API_KEY and FROM_EMAIL in backend/.env to activate.
Without the key, all send calls are logged but no-op.
"""

import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@rapidreps.com')
APP_NAME = 'RapidReps'

# ── helpers ────────────────────────────────────────────────────────────────────

def _sg_client():
    """Lazy SendGrid client — returns None if key is missing."""
    if not SENDGRID_API_KEY:
        return None
    from sendgrid import SendGridAPIClient
    return SendGridAPIClient(SENDGRID_API_KEY)


def _send(to_email: str, subject: str, html_content: str) -> bool:
    """Low-level send via SendGrid. Returns True on success."""
    client = _sg_client()
    if not client:
        logger.info(f"[EMAIL-NOOP] Would send '{subject}' to {to_email} (no SENDGRID_API_KEY)")
        return False
    try:
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        response = client.send(message)
        logger.info(f"[EMAIL] Sent '{subject}' to {to_email} — status {response.status_code}")
        return response.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"[EMAIL-ERROR] Failed to send '{subject}' to {to_email}: {e}")
        return False


# ── base template ──────────────────────────────────────────────────────────────

def _wrap(body_html: str) -> str:
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#f8f9fa;">
      <div style="background:linear-gradient(135deg,#1a2a5e,#1e3470);padding:28px 24px;text-align:center;border-radius:0 0 16px 16px;">
        <h1 style="color:#FF6A00;margin:0;font-size:26px;letter-spacing:2px;">RAPIDREPS</h1>
        <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">Uber for Personal Training</p>
      </div>
      <div style="padding:28px 24px;">
        {body_html}
      </div>
      <div style="text-align:center;padding:20px;color:#8892b0;font-size:12px;">
        &copy; {datetime.utcnow().year} RapidReps. All rights reserved.
      </div>
    </div>
    """


# ══════════════════════════════════════════════════════════════════════════════
#  EMAIL TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

# 1. Password Reset
def send_password_reset_email(to_email: str, reset_token: str, user_name: str) -> bool:
    reset_link = f"https://rapidreps.com/reset-password?token={reset_token}"
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Reset Your Password</h2>
        <p style="color:#4a5568;line-height:1.6;">Hi {user_name},</p>
        <p style="color:#4a5568;line-height:1.6;">We received a request to reset your password. Click the button below to create a new one. This link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="{reset_link}" style="display:inline-block;background:#FF6A00;color:#fff;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:16px;">Reset Password</a>
        </div>
        <p style="color:#8892b0;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    """)
    return _send(to_email, f'{APP_NAME} — Reset Your Password', html)


# 2. Welcome / Email Verification
def send_welcome_email(to_email: str, user_name: str, verification_token: Optional[str] = None) -> bool:
    verify_section = ""
    if verification_token:
        verify_link = f"https://rapidreps.com/verify-email?token={verification_token}"
        verify_section = f"""
        <div style="text-align:center;margin:24px 0;">
          <a href="{verify_link}" style="display:inline-block;background:#1FB8B4;color:#fff;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:16px;">Verify Email</a>
        </div>
        """
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Welcome to RapidReps!</h2>
        <p style="color:#4a5568;line-height:1.6;">Hey {user_name},</p>
        <p style="color:#4a5568;line-height:1.6;">You're all set! Whether you're training or getting trained, we're excited to have you on board.</p>
        {verify_section}
        <p style="color:#4a5568;line-height:1.6;">Here's what you can do next:</p>
        <ul style="color:#4a5568;line-height:2;">
          <li>Browse trainers near you</li>
          <li>Book your first session</li>
          <li>Start building your streak</li>
        </ul>
    """)
    return _send(to_email, f'Welcome to {APP_NAME}!', html)


# 3. Session Booked Confirmation
def send_session_booked_email(to_email: str, user_name: str, trainer_name: str, session_date: str, duration_min: int) -> bool:
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Session Booked</h2>
        <p style="color:#4a5568;line-height:1.6;">Hi {user_name},</p>
        <p style="color:#4a5568;line-height:1.6;">Your session with <strong>{trainer_name}</strong> has been confirmed!</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:4px 0;color:#4a5568;"><strong>Date:</strong> {session_date}</p>
          <p style="margin:4px 0;color:#4a5568;"><strong>Duration:</strong> {duration_min} minutes</p>
        </div>
        <p style="color:#4a5568;">Get ready to crush it!</p>
    """)
    return _send(to_email, f'{APP_NAME} — Session Booked with {trainer_name}', html)


# 4. Payment Receipt
def send_payment_receipt_email(to_email: str, user_name: str, amount_cents: int, description: str, payment_id: str) -> bool:
    amount = f"${amount_cents / 100:.2f}"
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Payment Receipt</h2>
        <p style="color:#4a5568;line-height:1.6;">Hi {user_name},</p>
        <p style="color:#4a5568;line-height:1.6;">Here's your payment confirmation:</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:4px 0;color:#4a5568;"><strong>Amount:</strong> {amount}</p>
          <p style="margin:4px 0;color:#4a5568;"><strong>Description:</strong> {description}</p>
          <p style="margin:4px 0;color:#8892b0;font-size:12px;">Reference: {payment_id}</p>
        </div>
    """)
    return _send(to_email, f'{APP_NAME} — Payment Receipt ({amount})', html)


# 5. Weekly Digest
def send_weekly_digest_email(
    to_email: str,
    user_name: str,
    sessions_this_week: int,
    total_minutes: int,
    current_streak: int,
    streak_level: str,
    leaderboard_rank: Optional[int],
) -> bool:
    rank_text = f"<p style='margin:4px 0;color:#4a5568;'><strong>Leaderboard:</strong> #{leaderboard_rank} this week</p>" if leaderboard_rank else ""
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Your Weekly Training Report</h2>
        <p style="color:#4a5568;line-height:1.6;">Hey {user_name}, here's how you did this week:</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:4px 0;color:#4a5568;"><strong>Sessions:</strong> {sessions_this_week}</p>
          <p style="margin:4px 0;color:#4a5568;"><strong>Total Time:</strong> {total_minutes} minutes</p>
          <p style="margin:4px 0;color:#4a5568;"><strong>Streak:</strong> {current_streak} weeks ({streak_level})</p>
          {rank_text}
        </div>
        <p style="color:#4a5568;line-height:1.6;">Keep going — consistency is what separates good from great!</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://rapidreps.com" style="display:inline-block;background:#FF6A00;color:#fff;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:16px;">Book Next Session</a>
        </div>
    """)
    return _send(to_email, f'{APP_NAME} — Your Weekly Report', html)


# 6. Streak Warning
def send_streak_warning_email(to_email: str, user_name: str, days_since: int, current_streak: int) -> bool:
    html = _wrap(f"""
        <h2 style="color:#FF6A00;margin:0 0 12px;">Don't Lose Your Streak!</h2>
        <p style="color:#4a5568;line-height:1.6;">Hey {user_name},</p>
        <p style="color:#4a5568;line-height:1.6;">It's been <strong>{days_since} days</strong> since your last session. Your <strong>{current_streak}-week streak</strong> will reset if you don't train by Sunday!</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://rapidreps.com" style="display:inline-block;background:#FF6A00;color:#fff;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:16px;">Book a Session Now</a>
        </div>
    """)
    return _send(to_email, f'{APP_NAME} — Your Streak is at Risk!', html)


# 7. Trainer Payout Notification
def send_payout_notification_email(to_email: str, trainer_name: str, amount_cents: int, session_count: int) -> bool:
    amount = f"${amount_cents / 100:.2f}"
    html = _wrap(f"""
        <h2 style="color:#1a2a5e;margin:0 0 12px;">Payout Processed</h2>
        <p style="color:#4a5568;line-height:1.6;">Hi {trainer_name},</p>
        <p style="color:#4a5568;line-height:1.6;">Your payout has been processed!</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:4px 0;color:#4a5568;"><strong>Amount:</strong> {amount}</p>
          <p style="margin:4px 0;color:#4a5568;"><strong>Sessions:</strong> {session_count} completed</p>
        </div>
    """)
    return _send(to_email, f'{APP_NAME} — Payout of {amount}', html)


# 8. Admin Alert (fraud, high-value transactions, etc.)
def send_admin_alert_email(to_email: str, alert_type: str, details: str) -> bool:
    html = _wrap(f"""
        <h2 style="color:#FF4757;margin:0 0 12px;">Admin Alert: {alert_type}</h2>
        <div style="background:#fff3f3;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="color:#4a5568;line-height:1.6;">{details}</p>
        </div>
        <p style="color:#8892b0;font-size:13px;">This is an automated alert from the RapidReps system.</p>
    """)
    return _send(to_email, f'{APP_NAME} Admin Alert — {alert_type}', html)
