from typing import Any, Dict, Optional, Tuple
from app.models import ActionType, DeclineCategory, Diagnosis

# Comprehensive mapping of Razorpay error code + reason pairs
TAXONOMY_MAP: Dict[Tuple[str, str], Dict[str, Any]] = {
    ("BAD_REQUEST_ERROR", "insufficient_funds"): {
        "category": DeclineCategory.INSUFFICIENT_FUNDS,
        "recoverability": 0.82,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Customer account balance low; highly recoverable when timed with salary/credit cycles.",
        "suggested_delay_hours": 24,
    },
    ("BAD_REQUEST_ERROR", "payment_failed_insufficient_funds"): {
        "category": DeclineCategory.INSUFFICIENT_FUNDS,
        "recoverability": 0.82,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Customer account balance insufficient for debit.",
        "suggested_delay_hours": 24,
    },
    ("GATEWAY_ERROR", "bank_technical_error"): {
        "category": DeclineCategory.TEMPORARY_BANK_ISSUE,
        "recoverability": 0.90,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Issuing bank server error/downtime; high recovery rate after brief cooldown.",
        "suggested_delay_hours": 4,
    },
    ("GATEWAY_ERROR", "decline_do_not_honor"): {
        "category": DeclineCategory.TEMPORARY_BANK_ISSUE,
        "recoverability": 0.45,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Bank generic decline flag; best to retry after bank clearance or notify user.",
        "suggested_delay_hours": 24,
    },
    ("GATEWAY_ERROR", "gateway_timeout"): {
        "category": DeclineCategory.GATEWAY_TIMEOUT,
        "recoverability": 0.94,
        "default_action": ActionType.RETRY_NOW,
        "reason": "Gateway handshake timed out; immediate or short-interval retry optimal.",
        "suggested_delay_hours": 1,
    },
    ("NETWORK_ERROR", "network_timeout"): {
        "category": DeclineCategory.NETWORK_GLITCH,
        "recoverability": 0.95,
        "default_action": ActionType.RETRY_NOW,
        "reason": "Network packet loss during transaction broadcast.",
        "suggested_delay_hours": 1,
    },
    ("NETWORK_ERROR", "connection_reset"): {
        "category": DeclineCategory.NETWORK_GLITCH,
        "recoverability": 0.95,
        "default_action": ActionType.RETRY_NOW,
        "reason": "Socket disconnected prematurely by intermediate switch.",
        "suggested_delay_hours": 1,
    },
    ("BAD_REQUEST_ERROR", "mandate_cancelled_by_customer"): {
        "category": DeclineCategory.CONSENT_WITHDRAWN,
        "recoverability": 0.0,
        "default_action": ActionType.HARD_STOP,
        "reason": "Explicit consent withdrawal by customer. Retrying violates RBI autopay mandate guidelines.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "consent_revoked"): {
        "category": DeclineCategory.CONSENT_WITHDRAWN,
        "recoverability": 0.0,
        "default_action": ActionType.HARD_STOP,
        "reason": "User revoked recurring debit mandate from bank/UPI app.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "card_expired"): {
        "category": DeclineCategory.CARD_EXPIRED,
        "recoverability": 0.10,
        "default_action": ActionType.SUGGEST_METHOD_SWITCH,
        "reason": "Debit/Credit card validity expired. Retries on same card will always fail.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "account_closed"): {
        "category": DeclineCategory.ACCOUNT_CLOSED,
        "recoverability": 0.0,
        "default_action": ActionType.HARD_STOP,
        "reason": "Bank account is closed or non-existent.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "account_dormant"): {
        "category": DeclineCategory.ACCOUNT_CLOSED,
        "recoverability": 0.0,
        "default_action": ActionType.HARD_STOP,
        "reason": "Bank account marked inactive/dormant by issuer.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "limit_exceeded"): {
        "category": DeclineCategory.LIMIT_EXCEEDED,
        "recoverability": 0.55,
        "default_action": ActionType.SOFT_NOTIFY,
        "reason": "Transaction exceeds customer's recurring mandate or per-transaction debit limit.",
        "suggested_delay_hours": 24,
    },
    ("BAD_REQUEST_ERROR", "daily_limit_exceeded"): {
        "category": DeclineCategory.LIMIT_EXCEEDED,
        "recoverability": 0.75,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Customer exceeded daily UPI/card quota; resets next day.",
        "suggested_delay_hours": 24,
    },
    ("AUTHENTICATION_ERROR", "auth_failed"): {
        "category": DeclineCategory.AUTHENTICATION_FAILED,
        "recoverability": 0.30,
        "default_action": ActionType.SOFT_NOTIFY,
        "reason": "Authentication handshake or MPIN/OTP validation failed.",
        "suggested_delay_hours": 12,
    },
    ("AUTHENTICATION_ERROR", "pin_incorrect"): {
        "category": DeclineCategory.AUTHENTICATION_FAILED,
        "recoverability": 0.30,
        "default_action": ActionType.SOFT_NOTIFY,
        "reason": "Incorrect UPI MPIN or token authentication failure.",
        "suggested_delay_hours": 12,
    },
    ("BAD_REQUEST_ERROR", "mandate_inactive"): {
        "category": DeclineCategory.MANDATE_INACTIVE,
        "recoverability": 0.10,
        "default_action": ActionType.SUGGEST_METHOD_SWITCH,
        "reason": "Mandate status is paused or inactive on NPCI/bank network.",
        "suggested_delay_hours": None,
    },
    ("BAD_REQUEST_ERROR", "risk_threshold_exceeded"): {
        "category": DeclineCategory.FRAUD_SUSPECTED,
        "recoverability": 0.0,
        "default_action": ActionType.ESCALATE,
        "reason": "Transaction blocked by Razorpay Thirdwatch or issuer fraud risk engine.",
        "suggested_delay_hours": None,
    },
}

FALLBACK_RULE_MAP: Dict[str, Dict[str, Any]] = {
    "funds": {
        "category": DeclineCategory.INSUFFICIENT_FUNDS,
        "recoverability": 0.75,
        "default_action": ActionType.SCHEDULE_RETRY,
        "reason": "Inferred insufficient funds from description pattern.",
        "suggested_delay_hours": 24,
    },
    "timeout": {
        "category": DeclineCategory.GATEWAY_TIMEOUT,
        "recoverability": 0.90,
        "default_action": ActionType.RETRY_NOW,
        "reason": "Inferred timeout from error pattern.",
        "suggested_delay_hours": 1,
    },
    "consent": {
        "category": DeclineCategory.CONSENT_WITHDRAWN,
        "recoverability": 0.0,
        "default_action": ActionType.HARD_STOP,
        "reason": "Inferred consent revocation from description.",
        "suggested_delay_hours": None,
    },
    "card": {
        "category": DeclineCategory.CARD_EXPIRED,
        "recoverability": 0.10,
        "default_action": ActionType.SUGGEST_METHOD_SWITCH,
        "reason": "Inferred card issue from description pattern.",
        "suggested_delay_hours": None,
    },
}


def classify_error_sync(
    error_code: str,
    error_reason: str,
    error_source: str = "customer",
    error_step: str = "payment_authorization",
    error_description: str = "",
) -> Diagnosis:
    """Deterministic fast-path lookup for Razorpay errors."""
    key = (error_code.strip().upper(), error_reason.strip().lower())
    if key in TAXONOMY_MAP:
        spec = TAXONOMY_MAP[key]
        return Diagnosis(
            category=spec["category"],
            recoverability=spec["recoverability"],
            recommended_action=spec["default_action"],
            reason=spec["reason"],
            confidence=0.98,
            suggested_delay_hours=spec.get("suggested_delay_hours"),
        )

    # Heuristic substring scan across reason and description
    combined_text = f"{error_reason} {error_description}".lower()
    for kw, rule in FALLBACK_RULE_MAP.items():
        if kw in combined_text:
            return Diagnosis(
                category=rule["category"],
                recoverability=rule["recoverability"],
                recommended_action=rule["default_action"],
                reason=rule["reason"],
                confidence=0.80,
                suggested_delay_hours=rule.get("suggested_delay_hours"),
            )

    # Unknown fallback
    return Diagnosis(
        category=DeclineCategory.UNKNOWN,
        recoverability=0.25,
        recommended_action=ActionType.ESCALATE,
        reason=f"Unrecognized Razorpay error signature [{error_code} / {error_reason}]. Escalate for manual triage.",
        confidence=0.50,
        suggested_delay_hours=None,
    )
