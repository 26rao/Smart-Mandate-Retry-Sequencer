from datetime import datetime, timezone
import pytest
from app.models import ActionType, DeclineCategory, Diagnosis, MandateFailure
from app.policy import can_retry, calculate_schedule_time, decide_action


def test_consent_withdrawn_hard_stop():
    failure = MandateFailure(
        id="mf_01",
        payment_id="pay_01",
        mandate_id="man_01",
        amount=199900,
        error_code="BAD_REQUEST_ERROR",
        error_reason="mandate_cancelled_by_customer",
        error_description="Revoked",
        attempt_number=1,
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.CONSENT_WITHDRAWN,
        recoverability=0.0,
        recommended_action=ActionType.HARD_STOP,
        reason="Revoked",
        confidence=1.0,
    )
    assert can_retry(failure, diagnosis) is False
    decision = decide_action(failure, diagnosis)
    assert decision.action == ActionType.HARD_STOP
    assert decision.is_safe is True
    assert decision.remaining_attempts == 0
    assert "NPCI UPI Autopay" in decision.regulatory_framework


def test_attempt_budget_exhaustion():
    failure = MandateFailure(
        id="mf_02",
        payment_id="pay_02",
        mandate_id="man_02",
        amount=250000,
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Balance low",
        attempt_number=4,
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.INSUFFICIENT_FUNDS,
        recoverability=0.8,
        recommended_action=ActionType.SCHEDULE_RETRY,
        reason="Balance low",
        confidence=0.9,
    )
    assert can_retry(failure, diagnosis) is False
    decision = decide_action(failure, diagnosis)
    assert decision.action == ActionType.HARD_STOP
    assert decision.remaining_attempts == 0


def test_salary_cycle_schedule_time():
    fixed_time = datetime(2026, 8, 28, 10, 0, 0, tzinfo=timezone.utc)
    failure = MandateFailure(
        id="mf_03",
        payment_id="pay_03",
        mandate_id="man_03",
        amount=150000,
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Low balance",
        attempt_number=1,
        salary_day_of_month=1,
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.INSUFFICIENT_FUNDS,
        recoverability=0.82,
        recommended_action=ActionType.SCHEDULE_RETRY,
        reason="Low balance",
        confidence=0.95,
    )
    sched = calculate_schedule_time(failure, diagnosis, current_time=fixed_time)
    assert sched > fixed_time
    assert (sched - fixed_time).days >= 3

    decision = decide_action(failure, diagnosis, current_time=fixed_time)
    assert decision.action == ActionType.SCHEDULE_RETRY
    assert decision.notice_sent_at is not None
    assert decision.earliest_retry_at is not None
    assert decision.earliest_retry_at > fixed_time


def test_rbi_emandate_regulatory_scoping():
    failure = MandateFailure(
        id="mf_04",
        payment_id="pay_04",
        mandate_id="man_04",
        amount=500000,
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Insufficient funds on card recurring",
        attempt_number=1,
        payment_method="card_recurring",
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.INSUFFICIENT_FUNDS,
        recoverability=0.8,
        recommended_action=ActionType.SCHEDULE_RETRY,
        reason="Insufficient funds",
        confidence=0.9,
    )
    decision = decide_action(failure, diagnosis)
    assert "RBI E-Mandate" in decision.regulatory_framework
    assert decision.payment_method == "card_recurring"
    assert decision.earliest_retry_at is not None
    assert decision.remaining_attempts == 2  # Card cap 3 - attempt 1 = 2 remaining


def test_24h_pre_debit_statutory_clamping():
    """Verify that even if LLM/Taxonomy suggests a 4h cooldown, policy clamps to 24h minimum floor."""
    now = datetime(2026, 8, 24, 5, 0, 0, tzinfo=timezone.utc)
    failure = MandateFailure(
        id="mf_05",
        payment_id="pay_05",
        mandate_id="man_05",
        amount=349900,
        error_code="PROCESSOR_DECLINE",
        error_reason="issuer_soft_decline_retry_advised",
        error_description="Transient soft decline",
        attempt_number=1,
        payment_method="card_recurring",
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.TEMPORARY_BANK_ISSUE,
        recoverability=0.88,
        recommended_action=ActionType.SCHEDULE_RETRY,
        suggested_delay_hours=4,  # LLM recommends 4 hours
        reason="Issuer soft decline",
        confidence=0.92,
    )
    decision = decide_action(failure, diagnosis, current_time=now)
    assert decision.action == ActionType.SCHEDULE_RETRY
    # Sched must NOT be 4 hours later (09:00 UTC); it MUST be clamped to 24 hours later (2026-08-25 05:00 UTC)
    assert decision.schedule_at >= decision.earliest_retry_at
    assert (decision.schedule_at - now).total_seconds() >= 24 * 3600
    assert decision.remaining_attempts == 2  # 3 max - 1 = 2
