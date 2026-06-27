"""
Public legal document endpoints for RapidReps.

Serves the Privacy Policy and Terms of Service as HTML (suitable for the
Apple App Store / Google Play Console "Privacy Policy URL" and "Terms URL"
fields) and as JSON (for any in-app or cross-platform consumer).

NOTE: Content here MUST stay in sync with the TypeScript source of truth
at /app/frontend/src/legal/content.ts. When you edit one, mirror the change
in the other.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/api/legal", tags=["legal"])

LEGAL_OWNER = "BlkPixelTech"
LEGAL_ADDRESS = "10219 Windsor Oaks Way, Lanham, MD 20706"
LEGAL_EMAIL = "admin@blkpixeltech.com"
LEGAL_JURISDICTION = "State of Maryland, USA"
LEGAL_EFFECTIVE_DATE = "June 26, 2026"

PRIVACY_SECTIONS = [
    ("1. Who we are",
     f"RapidReps is operated by {LEGAL_OWNER} (\"RapidReps,\" \"we,\" \"us,\" or \"our\"), a Maryland-based business with offices at {LEGAL_ADDRESS}. This Privacy Policy explains what data we collect when you use the RapidReps mobile app and related services, how we use it, who we share it with, and the choices you have. By using RapidReps you agree to this Policy. If you do not agree, please do not use the app."),
    ("2. Information we collect",
     "We collect the following categories of personal information:\n\n"
     "• Account information — name, email, phone number, password (hashed), date of birth, and role (trainee or trainer).\n\n"
     "• Profile content — profile photo, bio, training specialties, goals, certifications, pricing, highlight reel videos, vibe music selections.\n\n"
     "• Location data — precise GPS coordinates (foreground while the app is open, and \"en-route\" tracking during an active session if you grant background location permission) used to match nearby users, estimate arrival times, and display live session progress.\n\n"
     "• Payment information — billing details handled by our payment processor (Stripe). We never see or store full card numbers; we receive only a tokenized reference and transaction metadata. For trainer payouts, we collect the off-platform payout handle you choose to share (Zelle, PayPal, Venmo, or CashApp identifier) so our admin team can send your earnings.\n\n"
     "• Session and booking data — sessions you request, accept, complete, cancel; negotiation messages; reviews; tips; and timestamps.\n\n"
     "• Communications — in-app messages between trainees and trainers, support tickets, push notification responses.\n\n"
     "• Device & usage data — device model, OS version, app version, IP address, crash logs, analytics events, and feature interactions used to improve reliability and performance."),
    ("3. How we use your information",
     "We use personal information to:\n\n"
     "• Create and secure your account, authenticate sign-ins, and prevent fraud.\n"
     "• Match trainees with nearby trainers and display profiles, pricing, and availability.\n"
     "• Process payments through Stripe and arrange off-platform trainer payouts.\n"
     "• Provide live session tracking, ETAs, and routing via Google Maps and Places APIs.\n"
     "• Send transactional push notifications (booking confirmations, payment requests, session reminders) and, where permitted, occasional product updates.\n"
     "• Respond to support requests and resolve disputes between trainees and trainers.\n"
     "• Comply with legal obligations, enforce our Terms of Service, and protect the rights, safety, and property of RapidReps, users, and the public."),
    ("4. How we share information",
     "We share personal information only as follows:\n\n"
     "• Between trainees and trainers — limited profile fields, session details, and in-app messages necessary to coordinate a booking.\n\n"
     "• With service providers — Stripe (payment processing), Apple Push Notification Service and Firebase Cloud Messaging (push notifications), Google Maps Platform (maps, routing, places autocomplete), Sentry (crash reporting), SendGrid (transactional email), and our cloud hosting providers. These providers process data on our behalf under contractual confidentiality obligations.\n\n"
     "• With our admin team — to manually arrange off-platform trainer payouts (Zelle, PayPal, Venmo, CashApp).\n\n"
     "• For legal reasons — to comply with subpoenas, court orders, or other legal process; to enforce our Terms; to protect users from imminent harm; or in connection with a merger, acquisition, or sale of all or part of our business.\n\n"
     "We do NOT sell or rent your personal information to third parties for their own marketing."),
    ("5. Location data",
     "RapidReps requests \"While Using the App\" location permission to surface nearby trainers and estimate arrival times. If you grant \"Always\" (background) permission, we additionally track location during an active session that is in \"en-route\" status so the other party can see your live progress. Background tracking automatically stops when the session ends. You can revoke location access at any time in your device Settings; some features (matching, ETAs, live tracking) will not work without it. We retain precise location only for the duration of an active session, then store coarse or aggregated location metadata for analytics."),
    ("6. Payments and off-platform payouts",
     "All trainee payments are processed by Stripe, Inc. Your card details are entered directly into Stripe's secure SDK and never touch our servers. We receive a tokenized customer reference, a transaction ID, and a payment status.\n\n"
     "Trainer earnings are paid out manually by our admin team to the off-platform handle you choose (Zelle, PayPal, Venmo, or CashApp). To receive payouts you must provide an accurate handle in your profile. By providing a payout handle you authorize us to share it with the relevant payout-network counterparty to complete the transfer. We retain payout records for tax and audit purposes for at least 7 years."),
    ("7. Push notifications & deep links",
     "With your permission we send push notifications for events such as booking requests, payment requests (one-tap deep links to the in-app payment screen), session reminders, and messages. You can disable push notifications at any time in your device Settings or in the RapidReps notification preferences screen. Disabling notifications will not stop critical transactional emails sent via SendGrid."),
    ("8. Data retention",
     f"We retain account and session data for as long as your account is active and for a reasonable period afterward to satisfy legal, accounting, and dispute-resolution obligations (typically up to 7 years for financial records). You can request earlier deletion using the in-app \"Delete account\" control or by emailing {LEGAL_EMAIL}. We will honor verifiable deletion requests except where retention is required by law."),
    ("9. Your privacy rights",
     "Depending on where you live, you may have the right to:\n\n"
     "• Access — request a copy of the personal information we hold about you.\n"
     "• Correct — ask us to update inaccurate information.\n"
     "• Delete — ask us to delete your personal information, subject to legal retention limits.\n"
     "• Port — receive a machine-readable copy of certain data.\n"
     "• Opt-out — opt out of any \"sale\" or \"sharing\" of personal information for cross-context behavioral advertising. RapidReps does not sell or share personal information for advertising.\n\n"
     f"California residents have specific rights under the CCPA/CPRA, including the right to non-discrimination for exercising those rights. To exercise any right, email {LEGAL_EMAIL} from the address on file with us. We will verify your identity before fulfilling the request."),
    ("10. Children",
     f"RapidReps is intended for users 18 years of age or older. We do not knowingly collect personal information from anyone under 18. If you believe a child has provided us information, please contact {LEGAL_EMAIL} and we will delete it."),
    ("11. Security",
     "We use industry-standard safeguards including TLS in transit, encrypted password hashing (bcrypt), Stripe-tokenized payments, signed JWT sessions, role-based access controls on our backend, and crash monitoring via Sentry. No internet transmission or electronic storage is 100% secure, and we cannot guarantee absolute security."),
    ("12. International transfers",
     "RapidReps is operated from the United States. If you access the app from outside the U.S., your information will be transferred to and processed in the U.S. by us and our service providers under safeguards consistent with applicable law."),
    ("13. Changes to this Policy",
     "We may update this Privacy Policy from time to time. We will revise the \"Last updated\" date at the top and, for material changes, give in-app or email notice. Continued use after a change constitutes acceptance."),
    ("14. Contact",
     f"Questions, requests, or complaints about this Policy?\n\n{LEGAL_OWNER}\n{LEGAL_ADDRESS}\nEmail: {LEGAL_EMAIL}"),
]

TERMS_SECTIONS = [
    ("1. Acceptance and eligibility",
     f"These Terms of Service (\"Terms\") are a binding agreement between you and {LEGAL_OWNER}, located at {LEGAL_ADDRESS} (\"RapidReps,\" \"we,\" \"us,\" \"our\"). By creating an account, accessing, or using the RapidReps mobile application or any related services (collectively the \"Service\"), you agree to these Terms and to our Privacy Policy. You must be at least 18 years old and legally able to form a binding contract."),
    ("2. What RapidReps is — and is not",
     "RapidReps is a marketplace that connects independent fitness trainers (\"Trainers\") with people seeking training services (\"Trainees\"). Trainers are not employees, agents, partners, or franchisees of RapidReps. We do not provide fitness instruction, do not supervise sessions, do not verify a Trainer's certifications beyond what is presented in their profile, and do not guarantee any specific health, fitness, or financial outcome. All sessions occur between the Trainee and the Trainer directly. Use the in-app reporting and blocking tools and your own judgment when interacting with other users."),
    ("3. Accounts and security",
     f"You must provide accurate, current, and complete information when you register and keep it up to date. You are responsible for all activity that occurs under your account, including any sessions booked, payments authorized, or messages sent. Notify us immediately at {LEGAL_EMAIL} if you suspect unauthorized access. We may suspend or terminate accounts that violate these Terms, applicable law, or that we reasonably believe present risk to other users."),
    ("4. Bookings, payments, and fees",
     "Trainees pay for sessions through the app using a payment method processed by Stripe. The price shown before you confirm includes any platform fee, booking fee, and applicable taxes. Payment is captured only after a Trainer accepts the session and a one-tap payment confirmation is completed.\n\n"
     "Trainer earnings are paid out manually by our admin team to the off-platform handle (Zelle, PayPal, Venmo, or CashApp) that the Trainer maintains in their RapidReps profile. Payouts are issued on a regular cadence; RapidReps does not act as a money transmitter and does not hold funds beyond what is necessary to process bookings and resolve disputes.\n\n"
     "RapidReps may change fees with reasonable in-app notice. Fees applicable to a session are those displayed at the time you confirm the booking."),
    ("5. Cancellations and refunds",
     f"Cancellation and refund eligibility depends on session status, timing, and the Trainer's stated cancellation policy. Specific rules are surfaced in the app at the time of booking and on the session details screen. Refunds are issued back to the original payment method via Stripe and may take 5–10 business days to appear. If you believe you are owed a refund and cannot resolve it through the in-app flow, email {LEGAL_EMAIL} and we will review your request in good faith."),
    ("6. User content and conduct",
     "You retain ownership of photos, videos, profile content, vibe music selections, and messages you submit (\"User Content\") and grant RapidReps a worldwide, royalty-free, non-exclusive license to host, display, and transmit it solely to operate the Service. You represent that you have all necessary rights to your User Content.\n\n"
     "You agree not to upload or transmit content that is unlawful, infringing, defamatory, harassing, sexually explicit, sexual content involving minors, hateful, threatening, fraudulent, or that contains malware. You agree not to scrape, reverse-engineer, or interfere with the Service."),
    ("7. Fitness disclaimer and assumption of risk",
     "Physical training involves inherent risks including muscle strain, sprains, injury, cardiovascular events, and in rare cases serious harm or death. You represent that you are in adequate health to participate in fitness activities and have consulted your physician if you have any condition that may make exercise unsafe. You assume all risk associated with sessions booked through RapidReps. Trainers are independent and solely responsible for the safety, design, and execution of the sessions they deliver."),
    ("8. Reviews, ratings, and reports",
     "You may post reviews and ratings about Trainers based on your own experience. Reviews must be truthful, lawful, and not include personal attacks. We may remove reviews that violate these Terms. Use the in-app report and block tools to flag concerning behavior; we will review reports and may take action including warning, suspension, or removal of an account."),
    ("9. Termination",
     f"You may close your account at any time using the in-app \"Delete account\" control or by emailing {LEGAL_EMAIL}. We may suspend or terminate your access for any reason, including breach of these Terms, with or without notice. Sections that by their nature should survive termination (e.g., payments owed, disclaimers, limitation of liability, indemnification, arbitration) will survive."),
    ("10. Disclaimer of warranties",
     "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES; THAT TRAINERS' CONTENT IS ACCURATE; OR THAT YOU WILL ACHIEVE ANY PARTICULAR RESULT. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, IN WHICH CASE THE ABOVE EXCLUSION MAY NOT APPLY TO YOU."),
    ("11. Limitation of liability",
     f"TO THE FULLEST EXTENT PERMITTED BY LAW, RAPIDREPS AND {LEGAL_OWNER.upper()} (TOGETHER WITH THEIR OWNERS, OFFICERS, EMPLOYEES, AND AGENTS) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS PAID BY YOU TO RAPIDREPS IN THE 12 MONTHS PRECEDING THE CLAIM OR (B) USD $100."),
    ("12. Indemnification",
     f"You agree to indemnify, defend, and hold harmless RapidReps, {LEGAL_OWNER}, and their officers, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of or related to (a) your use of the Service, (b) your User Content, (c) your interactions with other users including sessions booked or delivered, or (d) your breach of these Terms or applicable law."),
    ("13. Dispute resolution — arbitration and class-action waiver",
     f"Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by final and binding arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, in {LEGAL_JURISDICTION}, in the English language. The arbitrator's decision may be entered as a judgment in any court of competent jurisdiction. You and RapidReps waive any right to a jury trial and to participate in a class, consolidated, or representative action. You may opt out of this arbitration agreement by sending written notice to {LEGAL_EMAIL} within 30 days of first accepting these Terms. Either party may bring an individual action in small-claims court instead of arbitration if eligible."),
    ("14. Governing law",
     f"These Terms and any dispute arising out of them are governed by the laws of the {LEGAL_JURISDICTION}, without regard to its conflict-of-laws principles. For any matter not subject to arbitration, the state and federal courts located in Prince George's County, Maryland have exclusive jurisdiction."),
    ("15. Changes to these Terms",
     "We may update these Terms from time to time. We will revise the \"Last updated\" date and, for material changes, provide in-app or email notice. Continued use after the effective date of an update constitutes acceptance."),
    ("16. Contact",
     f"{LEGAL_OWNER}\n{LEGAL_ADDRESS}\nEmail: {LEGAL_EMAIL}"),
]


def _render_html(title: str, sections: list[tuple[str, str]]) -> str:
    """Produce a clean, mobile-friendly HTML page (no external deps)."""
    body_html = ""
    for sec_title, sec_body in sections:
        body_html += f"<section><h2>{sec_title}</h2><p>{sec_body.replace(chr(10), '<br/>')}</p></section>"
    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\"/>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>
  <title>{title} — RapidReps</title>
  <style>
    :root {{ color-scheme: light dark; }}
    body {{
      margin: 0; padding: 24px 18px 64px;
      max-width: 760px; margin-left: auto; margin-right: auto;
      font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1A2035; background: #FAFBFC;
    }}
    @media (prefers-color-scheme: dark) {{
      body {{ color: #E6E9F0; background: #0D1117; }}
      h1 {{ color: #FFF; }}
      h2 {{ color: #F7931E; }}
      .updated {{ color: #8B95B0; }}
    }}
    h1 {{ font-size: 28px; margin: 0 0 8px; letter-spacing: 0.3px; }}
    h2 {{ font-size: 18px; margin: 28px 0 8px; color: #1a2a5e; }}
    .updated {{ font-size: 13px; color: #5a6785; margin-bottom: 28px; }}
    p {{ margin: 0 0 8px; white-space: pre-wrap; }}
    section {{ margin-bottom: 18px; }}
    footer {{ font-size: 12px; color: #8B95B0; margin-top: 48px; border-top: 1px solid rgba(128,128,128,0.2); padding-top: 16px; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  <p class=\"updated\">Last updated: {LEGAL_EFFECTIVE_DATE}</p>
  {body_html}
  <footer>{LEGAL_OWNER} · {LEGAL_ADDRESS} · {LEGAL_EMAIL}</footer>
</body>
</html>"""


@router.get("/privacy.html", response_class=HTMLResponse, include_in_schema=False)
async def privacy_html() -> HTMLResponse:
    return HTMLResponse(content=_render_html("Privacy Policy", PRIVACY_SECTIONS))


@router.get("/terms.html", response_class=HTMLResponse, include_in_schema=False)
async def terms_html() -> HTMLResponse:
    return HTMLResponse(content=_render_html("Terms of Service", TERMS_SECTIONS))


@router.get("/privacy")
async def privacy_json() -> dict:
    return {
        "owner": LEGAL_OWNER,
        "address": LEGAL_ADDRESS,
        "email": LEGAL_EMAIL,
        "effective_date": LEGAL_EFFECTIVE_DATE,
        "sections": [{"title": t, "body": b} for t, b in PRIVACY_SECTIONS],
    }


@router.get("/terms")
async def terms_json() -> dict:
    return {
        "owner": LEGAL_OWNER,
        "address": LEGAL_ADDRESS,
        "email": LEGAL_EMAIL,
        "effective_date": LEGAL_EFFECTIVE_DATE,
        "jurisdiction": LEGAL_JURISDICTION,
        "sections": [{"title": t, "body": b} for t, b in TERMS_SECTIONS],
    }
