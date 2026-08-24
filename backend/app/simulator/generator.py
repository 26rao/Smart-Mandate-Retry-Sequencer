import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from app.models import MandateFailure
from app.simulator.personas import PERSONAS

ERROR_PATTERNS = [
    (
        40,
        "BAD_REQUEST_ERROR",
        "insufficient_funds",
        "customer",
        "payment_authorization",
        "Account balance is lower than transaction amount.",
    ),
    (
        18,
        "GATEWAY_ERROR",
        "bank_technical_error",
        "bank",
        "payment_authorization",
        "Issuing bank system momentarily unavailable or in nightly maintenance.",
    ),
    (
        12,
        "NETWORK_ERROR",
        "network_timeout",
        "gateway",
        "payment_authorization",
        "Connection timed out waiting for NPCI switch response.",
    ),
    (
        10,
        "BAD_REQUEST_ERROR",
        "mandate_cancelled_by_customer",
        "customer",
        "mandate_validation",
        "The customer has cancelled the recurring mandate in their UPI/Bank app.",
    ),
    (
        8,
        "BAD_REQUEST_ERROR",
        "card_expired",
        "customer",
        "payment_authorization",
        "The saved card token has expired. Expiry date passed.",
    ),
    (
        5,
        "BAD_REQUEST_ERROR",
        "limit_exceeded",
        "bank",
        "payment_authorization",
        "Transaction exceeds maximum allowed limit per mandate execution.",
    ),
    (
        4,
        "AUTHENTICATION_ERROR",
        "auth_failed",
        "customer",
        "payment_authorization",
        "Customer MPIN/Biometric authentication failed or expired.",
    ),
    (
        3,
        "BAD_REQUEST_ERROR",
        "account_closed",
        "bank",
        "payment_authorization",
        "Target bank account is permanently closed or frozen.",
    ),
]


def generate_synthetic_failures(
    count: int = 250,
    seed: int = 42,
) -> List[MandateFailure]:
    """Generate reproducible realistic mandate failure dataset."""
    random.seed(seed)
    failures: List[MandateFailure] = []
    persona_keys = list(PERSONAS.keys())

    error_choices = []
    error_weights = []
    for weight, code, reason, source, step, desc in ERROR_PATTERNS:
        error_choices.append((code, reason, source, step, desc))
        error_weights.append(weight)

    base_time = datetime(2026, 8, 15, 8, 30, 0, tzinfo=timezone.utc)

    for i in range(count):
        code, reason, source, step, desc = random.choices(error_choices, weights=error_weights, k=1)[0]

        if reason in {"mandate_cancelled_by_customer", "account_closed"}:
            persona_id = random.choice(["attrited_churner", "chronic_defaulter"])
        elif reason == "card_expired":
            persona_id = random.choice(["salaried_corporate", "hnw_subscriber", "gig_freelancer"])
        elif reason == "limit_exceeded":
            persona_id = random.choice(["hnw_subscriber", "salaried_corporate"])
        elif reason == "insufficient_funds":
            persona_id = random.choice(["salaried_corporate", "mid_month_salaried", "gig_freelancer", "chronic_defaulter"])
        else:
            persona_id = random.choice(persona_keys)

        persona = PERSONAS[persona_id]
        amount = random.randint(persona.typical_amount_range[0], persona.typical_amount_range[1])
        amount = (amount // 5000) * 5000 if amount > 5000 else amount

        delta_days = random.randint(0, 14)
        delta_hours = random.randint(0, 23)
        delta_minutes = random.randint(0, 59)
        created_at = base_time - timedelta(days=delta_days, hours=delta_hours, minutes=delta_minutes)

        attempt = random.choices([1, 2, 3], weights=[70, 20, 10], k=1)[0]

        failure = MandateFailure(
            id=f"mf_{uuid.uuid4().hex[:10]}",
            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
            mandate_id=f"man_{uuid.uuid4().hex[:12]}",
            amount=amount,
            currency="INR",
            error_code=code,
            error_reason=reason,
            error_source=source,
            error_step=step,
            error_description=desc,
            customer_id=f"cust_{uuid.uuid4().hex[:8]}",
            customer_persona=persona_id,
            created_at=created_at,
            attempt_number=attempt,
            salary_day_of_month=persona.salary_day_of_month,
            is_terminal=reason in {"mandate_cancelled_by_customer", "account_closed"},
        )
        failures.append(failure)

    return failures


def export_sample_failures_json(output_path: str = "data/sample_failures.json", count: int = 250):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    failures = generate_synthetic_failures(count=count, seed=42)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump([item.model_dump(mode="json") for item in failures], f, indent=2)
    return len(failures)
