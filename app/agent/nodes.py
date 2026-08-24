from typing import Dict, Any
from app.agent.state import SequencerState
from app.models import ActionType, DeclineCategory, Diagnosis
from app.policy import decide_action
from app.services.llm import classify_with_llm
from app.services.razorpay_client import razorpay_service
from app.taxonomy import classify_error_sync


async def detect_node(state: SequencerState) -> SequencerState:
    """Stage 1: Ingest & validate incoming mandate failure event."""
    state.current_stage = "detected"
    state.add_audit(
        stage="detect",
        input_data={
            "failure_id": state.failure.id,
            "payment_id": state.failure.payment_id,
            "error_code": state.failure.error_code,
            "error_reason": state.failure.error_reason,
            "attempt_number": state.failure.attempt_number,
        },
        output_data={"status": "ingested", "amount_inr": state.failure.amount / 100},
        llm_used=False,
        notes="Mandate failure event ingested into sequencer queue.",
    )
    return state


async def diagnose_node(state: SequencerState) -> SequencerState:
    """Stage 2: Classify failure using hard taxonomy + LLM fallback."""
    f = state.failure
    llm_used = False

    # 1. Fast-path lookup
    diagnosis = classify_error_sync(
        error_code=f.error_code,
        error_reason=f.error_reason,
        error_source=f.error_source,
        error_step=f.error_step,
        error_description=f.error_description,
    )

    # 2. LLM fallback if unknown
    if diagnosis.category == DeclineCategory.UNKNOWN:
        llm_diag = await classify_with_llm(
            error_code=f.error_code,
            error_reason=f.error_reason,
            error_source=f.error_source,
            error_step=f.error_step,
            error_description=f.error_description,
        )
        if llm_diag:
            diagnosis = llm_diag
            llm_used = True
        else:
            # Conservative Deterministic Fallback on LLM Outage/Timeout
            diagnosis = Diagnosis(
                category=DeclineCategory.UNKNOWN,
                recoverability=0.30,
                recommended_action=ActionType.SOFT_NOTIFY,
                reason="LLM Diagnostic Service unavailable or timed out. Gracefully degraded to conservative soft notification.",
                confidence=0.70,
                suggested_delay_hours=None,
                llm_model=None,
                raw_reasoning="Graceful Degradation Event: LLM service unavailable or timed out. System defaulted to safest zero-debit customer notification (0 risk, 0 attempt waste).",
            )

    state.diagnosis = diagnosis
    state.current_stage = "diagnosed"
    state.add_audit(
        stage="diagnose",
        input_data={
            "error_code": f.error_code,
            "error_reason": f.error_reason,
            "error_description": f.error_description,
        },
        output_data=diagnosis.model_dump(),
        llm_used=llm_used,
        notes=f"Categorized as [{diagnosis.category.value}] with recoverability {diagnosis.recoverability:.2f}",
    )
    return state


async def decide_node(state: SequencerState) -> SequencerState:
    """Stage 3: Enforce strict deterministic safety policy."""
    if not state.diagnosis:
        raise ValueError("Cannot decide without diagnosis")

    decision = decide_action(failure=state.failure, diagnosis=state.diagnosis)
    state.decision = decision
    state.current_stage = "decided"
    state.add_audit(
        stage="decide",
        input_data={
            "category": state.diagnosis.category.value,
            "attempt_number": state.failure.attempt_number,
            "salary_day": state.failure.salary_day_of_month,
        },
        output_data=decision.model_dump(mode="json"),
        llm_used=False,
        notes=decision.rationale,
    )
    return state


async def execute_node(state: SequencerState) -> SequencerState:
    """Stage 4: Execute or schedule action via Razorpay client & notification router."""
    if not state.decision:
        raise ValueError("Cannot execute without decision")

    action = state.decision.action
    exec_result: Dict[str, Any] = {"action": action.value}

    if action == ActionType.RETRY_NOW:
        res = razorpay_service.retry_mandate_or_payment(
            payment_id=state.failure.payment_id,
            mandate_id=state.failure.mandate_id,
            amount=state.failure.amount,
            currency=state.failure.currency,
            customer_id=state.failure.customer_id,
        )
        exec_result.update(res)
        state.current_stage = "executed"

    elif action == ActionType.SCHEDULE_RETRY:
        exec_result["scheduled_for"] = (
            state.decision.schedule_at.isoformat() if state.decision.schedule_at else None
        )
        exec_result["message"] = "Debit retry queued in scheduled dispatcher."
        state.current_stage = "executed"

    elif action in {ActionType.SUGGEST_METHOD_SWITCH, ActionType.SOFT_NOTIFY}:
        exec_result["notification_dispatched"] = True
        exec_result["copy"] = state.decision.message_template
        state.current_stage = "executed"

    elif action == ActionType.HARD_STOP:
        exec_result["mandate_terminated"] = True
        exec_result["message"] = "Mandate retry loop terminated to protect merchant compliance."
        state.current_stage = "stopped"

    elif action == ActionType.ESCALATE:
        exec_result["escalated_to_ops"] = True
        exec_result["message"] = "Escalated to merchant operations queue."
        state.current_stage = "escalated"

    state.execution_result = exec_result
    state.is_finished = True
    state.add_audit(
        stage="execute",
        input_data={"action": action.value},
        output_data=exec_result,
        llm_used=False,
        notes=exec_result.get("message", f"Action {action.value} executed successfully."),
    )
    return state
