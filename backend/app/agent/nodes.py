from datetime import datetime, timezone
from typing import Dict, Any
from app.agent.state import SequencerState
from app.models import ActionType, DeclineCategory, Diagnosis
from app.policy import decide_action
from app.services.llm import classify_with_llm
from app.services.razorpay_client import create_retry_order, razorpay_service
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
        llm_model=diagnosis.llm_model if llm_used else None,
        notes=diagnosis.raw_reasoning if llm_used else f"Categorized as [{diagnosis.category.value}] with recoverability {diagnosis.recoverability:.2f}",
    )
    return state


async def decide_node(state: SequencerState) -> SequencerState:
    """Stage 3: Enforce strict deterministic safety & economic policy."""
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
    """Stage 4: Execute or schedule action via Razorpay client & notification router with idempotency guard."""
    if not state.decision:
        raise ValueError("Cannot execute without decision")

    d = state.decision
    f = state.failure
    action = d.action
    exec_result: Dict[str, Any] = {
        "action": action.value,
        "mandate_failure_id": f.id,
        "payment_method": d.payment_method,
        "regulatory_framework": d.regulatory_framework,
        "expected_value_inr": d.expected_value_inr,
    }

    # Idempotency guard: if order is already assigned, reuse it
    if d.razorpay_order_id:
        exec_result["status"] = "idempotent_cached"
        exec_result["razorpay_order_id"] = d.razorpay_order_id
        exec_result["message"] = "Execution was previously recorded; duplicate charge prevented."
        state.execution_result = exec_result
        state.is_finished = True
        return state

    if action in {ActionType.RETRY_NOW, ActionType.SCHEDULE_RETRY}:
        order_resp = create_retry_order(
            amount=f.amount,
            currency=f.currency,
            payment_id=f.payment_id,
            mandate_id=f.mandate_id,
            attempt_number=f.attempt_number,
            category=state.diagnosis.category.value if state.diagnosis else "unknown",
            mandate_failure_id=f.id,
        )
        d.razorpay_order_id = order_resp.get("id")
        exec_result["razorpay_order"] = order_resp
        exec_result["razorpay_order_id"] = order_resp.get("id")
        exec_result["status"] = "order_created" if not order_resp.get("status") == "dry_run" else "dry_run_dispatched"
        if action == ActionType.SCHEDULE_RETRY:
            exec_result["scheduled_for"] = d.schedule_at.isoformat() if d.schedule_at else None
        state.current_stage = "executed"

    elif action in {ActionType.SUGGEST_METHOD_SWITCH, ActionType.SOFT_NOTIFY}:
        exec_result["notification_dispatched"] = True
        exec_result["copy"] = d.message_template
        state.current_stage = "executed"

    elif action == ActionType.HARD_STOP:
        exec_result["mandate_terminated"] = True
        exec_result["message"] = "Mandate retry loop terminated to protect merchant compliance and unit economics."
        state.current_stage = "stopped"

    elif action == ActionType.ESCALATE:
        exec_result["escalated_to_ops"] = True
        exec_result["message"] = "Escalated to merchant operations queue."
        state.current_stage = "escalated"

    state.execution_result = exec_result
    state.is_finished = True
    state.add_audit(
        stage="execute",
        input_data={"action": action.value, "attempt": f.attempt_number},
        output_data=exec_result,
        llm_used=False,
        notes=f"Executed [{action.value}] under {d.regulatory_framework}. Razorpay Order: {d.razorpay_order_id or 'N/A'}",
    )
    return state
