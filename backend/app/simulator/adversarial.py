"""
Adversarial Stress Cohort Generator.

Simulates a high-stress fintech environment with:
- 3x rate of hard declines (consent cancellations, closed accounts)
- 2.5x rate of expired card tokens
- Highly irregular gig/freelancer cashflow patterns (high default propensity)
- Frequent gateway timeouts
"""

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from app.models import MandateFailure
from app.simulator.personas import PERSONAS

ADVERSARIAL_PATTERNS = [
    (
        25,
        "BAD_REQUEST_ERROR",
        "mandate_cancelled_by_customer",
        "customer",
        "mandate_validation",
        "Adversarial condition: Customer proactively cancelled autopay mandate.",
    ),
    (
        20,
        "BAD_REQUEST_ERROR",
        "card_expired",
        "customer",
        "payment_authorization",
        "Adversarial condition: Card token expired en-masse post RBI co-badging norms.",
    ),
    (
        25,
        "BAD_REQUEST_ERROR",
        "insufficient_funds",
        "customer",
        "payment_authorization",
        "Adversarial condition: Irregular cash-flow freelancer account with depleted balance.",
    ),
    (
        15,
        "BAD_REQUEST_ERROR",
        "account_closed",
        "bank",
        "payment_authorization",
        "Adversarial condition: Target bank account frozen or in NPA resolution.",
    ),
    (
        10,
        "GATEWAY_ERROR",
        "bank_technical_error",
        "bank",
        "payment_authorization",
        "Adversarial condition: Severe core banking outage across major public sector banks.",
    ),
    (
        5,
        "NETWORK_ERROR",
        "network_timeout",
        "gateway",
        "payment_authorization",
        "Adversarial condition: NPCI switch throttle timeout.",
    ),
]


def generate_adversarial_failures(
    count: int = 250,
    seed: int = 999,
) -> List[MandateFailure]:
    """Generate reproducible adversarial stress test mandate failures."""
    random.seed(seed)
    failures: List[MandateFailure] = []

    error_choices = []
    error_weights = []
    for weight, code, reason, source, step, desc in ADVERSARIAL_PATTERNS:
        error_choices.append((code, reason, source, step, desc))
        error_weights.append(weight)

    base_time = datetime(2026, 8, 20, 14, 0, 0, tzinfo=timezone.utc)

    for i in range(count):
        code, reason, source, step, desc = random.choices(error_choices, weights=error_weights, k=1)[0]

        if reason in {"mandate_cancelled_by_customer", "account_closed"}:
            persona_id = random.choice(["attrited_churner", "chronic_defaulter"])
        elif reason == "card_expired":
            persona_id = "gig_freelancer"
        else:
            persona_id = random.choice(list(PERSONAS.keys()))

        persona_meta = PERSONAS[persona_id]
        amt_paisa = random.randint(persona_meta.typical_amount_range[0], persona_meta.typical_amount_range[1])
        payment_method = random.choices(
            ["card_recurring", "upi_autopay", "nach_debit"],
            weights=[50, 40, 10],
            k=1,
        )[0]
        attempt = random.choices([1, 2, 3], weights=[70, 20, 10], k=1)[0]
        salary_day = persona_meta.salary_day_of_month

        fail_time = base_time + timedelta(
            days=random.randint(0, 10),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )

        failures.append(
            MandateFailure(
                id=f"mf_adv_{seed}_{i+1:04d}",
                payment_id=f"pay_adv_{uuid.uuid4().hex[:8]}",
                mandate_id=f"order_adv_{uuid.uuid4().hex[:8]}",
                customer_id=f"cust_adv_{persona_id[:4]}_{i+1:03d}",
                amount=amt_paisa,
                currency="INR",
                error_code=code,
                error_reason=reason,
                error_source=source,
                error_step=step,
                error_description=desc,
                attempt_number=attempt,
                payment_method=payment_method,
                customer_persona=persona_id,
                salary_day_of_month=salary_day,
                created_at=fail_time,
            )
        )

    return failures
