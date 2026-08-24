import pytest
from app.agent.graph import sequencer_agent
from app.models import ActionType, DeclineCategory, MandateFailure


@pytest.mark.asyncio
async def test_sequencer_insufficient_funds_e2e():
    failure = MandateFailure(
        id="mf_e2e_01",
        payment_id="pay_e2e_01",
        mandate_id="man_e2e_01",
        amount=299900,
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Account balance low.",
        attempt_number=1,
        salary_day_of_month=1,
    )
    state = await sequencer_agent.run(failure)
    assert state.is_finished is True
    assert state.diagnosis.category == DeclineCategory.INSUFFICIENT_FUNDS
    assert state.decision.action == ActionType.SCHEDULE_RETRY
    assert state.decision.schedule_at is not None
    assert len(state.audit_trail) == 4  # detect, diagnose, decide, execute


@pytest.mark.asyncio
async def test_sequencer_revoked_consent_hard_stop_e2e():
    failure = MandateFailure(
        id="mf_e2e_02",
        payment_id="pay_e2e_02",
        mandate_id="man_e2e_02",
        amount=149900,
        error_code="BAD_REQUEST_ERROR",
        error_reason="mandate_cancelled_by_customer",
        error_description="Customer revoked mandate in bank app.",
        attempt_number=1,
    )
    state = await sequencer_agent.run(failure)
    assert state.is_finished is True
    assert state.diagnosis.category == DeclineCategory.CONSENT_WITHDRAWN
    assert state.decision.action == ActionType.HARD_STOP
    assert state.execution_result["mandate_terminated"] is True
    assert state.current_stage == "stopped"


@pytest.mark.asyncio
async def test_sequencer_card_expired_method_switch_e2e():
    failure = MandateFailure(
        id="mf_e2e_03",
        payment_id="pay_e2e_03",
        mandate_id="man_e2e_03",
        amount=99900,
        error_code="BAD_REQUEST_ERROR",
        error_reason="card_expired",
        error_description="Card token expired.",
        attempt_number=1,
    )
    state = await sequencer_agent.run(failure)
    assert state.is_finished is True
    assert state.diagnosis.category == DeclineCategory.CARD_EXPIRED
    assert state.decision.action == ActionType.SUGGEST_METHOD_SWITCH
    assert state.decision.message_template is not None
