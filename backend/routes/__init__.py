"""Shared route dependencies. All route files import from here."""
from deps import db, get_current_user, serialize_doc, sanitize_text
from deps import (
    hash_password, verify_password, create_access_token, decode_token,
    calculate_distance, generate_safety_pin, calculate_travel_fee,
    get_session_minimum_price, get_cancellation_fee, calculate_trainer_tier,
    check_trainer_can_go_live, calculate_session_payout, calculate_travel_fee_split,
    calculate_cancellation_fee_detail, calculate_time_based_cancellation_penalty,
    get_minimum_price, calculate_session_pricing,
    send_push_notification, send_push_to_many,
    VALID_PERSONALITY_TAGS, EXPO_PUSH_URL,
)
from models import *

# Re-export haversine for backward compatibility
haversine_miles = calculate_distance

# Re-export send_push alias used by existing route files
send_push = send_push_notification
