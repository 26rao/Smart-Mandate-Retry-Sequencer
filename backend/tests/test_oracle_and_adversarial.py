import pytest
from datetime import datetime, timezone
from app.models import MandateFailure, DeclineCategory, Diagnosis, ActionType
from app.policy import adjust_for_bank_holidays, is_indian_bank_holiday, decide_action
from app.simulator.generator import generate_synthetic_failures
from app.simulator.adversarial import generate_adversarial_failures
from app.simulator.oracle import TheoreticalOracle, RazorpayDefaultSmartRetryBaseline
from app.utils.metrics import evaluator


def test_theoretical_oracle_upper_bound():
    failures = generate_synthetic_failures(count=50, seed=42)
    oracle_res = TheoreticalOracle.evaluate(failures)
    
    assert oracle_res["total_mandates"] == 50
    assert oracle_res["recovery_rate_pct"] > 70.0
    assert oracle_res["policy_violations"] == 0
    assert oracle_res["compliance_pct"] == 100.0


def test_razorpay_default_retry_baseline():
    failures = generate_synthetic_failures(count=50, seed=42)
    rzp_res = RazorpayDefaultSmartRetryBaseline.evaluate(failures)
    
    assert rzp_res["total_mandates"] == 50
    assert rzp_res["recovery_rate_pct"] > 50.0
    # Default smart retry is better than naive calendar but still causes violations on revoked mandates
    assert rzp_res["avg_attempts_per_mandate"] > 2.0


def test_bank_holiday_adjustment():
    # Republic Day: 26 Jan 2026 (Monday) -> Bank Holiday
    rep_day = datetime(2026, 1, 26, 4, 0, 0, tzinfo=timezone.utc)
    assert is_indian_bank_holiday(rep_day) is True
    
    adjusted, delayed = adjust_for_bank_holidays(rep_day)
    assert delayed is True
    assert adjusted.day == 27  # Moved to 27 Jan


def test_adversarial_stress_cohort():
    adv_failures = generate_adversarial_failures(count=50, seed=999)
    assert len(adv_failures) == 50
    # Adversarial cohort contains higher proportion of consent revocations & card expirations
    revoked_or_expired = [f for f in adv_failures if f.error_reason in {"mandate_cancelled_by_customer", "card_expired", "account_closed"}]
    assert len(revoked_or_expired) >= 15


def test_counterfactual_action_generation():
    failure = MandateFailure(
        id="mf_cf_01",
        payment_id="pay_01",
        mandate_id="man_01",
        amount=299900,
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Balance low",
        attempt_number=1,
    )
    diagnosis = Diagnosis(
        category=DeclineCategory.INSUFFICIENT_FUNDS,
        recoverability=0.82,
        recommended_action=ActionType.SCHEDULE_RETRY,
        reason="Balance low",
        confidence=0.95,
    )
    decision = decide_action(failure, diagnosis)
    assert decision.action == ActionType.SCHEDULE_RETRY
    assert decision.counterfactuals is not None
    assert len(decision.counterfactuals) >= 4
    
    # Check that retry_now was evaluated and rejected with rationale
    cf_retry_now = next((cf for cf in decision.counterfactuals if cf["action"] == "retry_now"), None)
    assert cf_retry_now is not None
    assert "liquidity deficit" in cf_retry_now["rejection_reason"].lower()


@pytest.mark.asyncio
async def test_parameter_sensitivity_sweep():
    res = await evaluator.run_parameter_sensitivity_sweep(count=50, seed=42)
    assert "sweep_runs" in res
    assert len(res["sweep_runs"]) == 7
    for run in res["sweep_runs"]:
        # Smart sequencer must maintain positive lift over calendar baseline across all ±30% prior perturbations
        assert run["net_lift_vs_calendar_pct"] > 0
