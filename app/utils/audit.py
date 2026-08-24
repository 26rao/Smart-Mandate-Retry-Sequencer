import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.database import SyncSessionLocal, AsyncSessionLocal
from app.models import DBAuditEntry, DBDecision, DBMandateFailure
from app.agent.state import SequencerState


async def save_sequencer_state_async(state: SequencerState):
    """Persist mandate failure, decision, and all audit logs asynchronously."""
    async with AsyncSessionLocal() as session:
        # Save failure
        f = state.failure
        db_f = DBMandateFailure(
            id=f.id,
            payment_id=f.payment_id,
            mandate_id=f.mandate_id,
            customer_id=f.customer_id,
            customer_persona=f.customer_persona,
            amount=f.amount,
            currency=f.currency,
            error_code=f.error_code,
            error_reason=f.error_reason,
            error_source=f.error_source,
            error_step=f.error_step,
            error_description=f.error_description,
            attempt_number=f.attempt_number,
            salary_day_of_month=f.salary_day_of_month,
            is_terminal=f.is_terminal,
            created_at=f.created_at,
        )
        await session.merge(db_f)

        # Save decision
        if state.decision:
            d = state.decision
            db_d = DBDecision(
                id=f"dec_{f.id}_{uuid.uuid4().hex[:6]}",
                mandate_failure_id=f.id,
                action=d.action.value,
                schedule_at=d.schedule_at,
                message_template=d.message_template,
                rationale=d.rationale,
                remaining_attempts=d.remaining_attempts,
                confidence=d.confidence,
                is_safe=d.is_safe,
            )
            session.add(db_d)

        # Save audit entries
        for a in state.audit_trail:
            db_a = DBAuditEntry(
                id=a.id or f"aud_{uuid.uuid4().hex}",
                mandate_failure_id=a.mandate_failure_id,
                timestamp=a.timestamp,
                stage=a.stage,
                input_data=a.input_data,
                output_data=a.output_data,
                llm_used=a.llm_used,
                notes=a.notes,
            )
            session.add(db_a)

        await session.commit()


def save_sequencer_state_sync(state: SequencerState):
    """Persist mandate failure, decision, and all audit logs synchronously."""
    with SyncSessionLocal() as session:
        f = state.failure
        db_f = DBMandateFailure(
            id=f.id,
            payment_id=f.payment_id,
            mandate_id=f.mandate_id,
            customer_id=f.customer_id,
            customer_persona=f.customer_persona,
            amount=f.amount,
            currency=f.currency,
            error_code=f.error_code,
            error_reason=f.error_reason,
            error_source=f.error_source,
            error_step=f.error_step,
            error_description=f.error_description,
            attempt_number=f.attempt_number,
            salary_day_of_month=f.salary_day_of_month,
            is_terminal=f.is_terminal,
            created_at=f.created_at,
        )
        session.merge(db_f)

        if state.decision:
            d = state.decision
            db_d = DBDecision(
                id=f"dec_{f.id}_{uuid.uuid4().hex[:6]}",
                mandate_failure_id=f.id,
                action=d.action.value,
                schedule_at=d.schedule_at,
                message_template=d.message_template,
                rationale=d.rationale,
                remaining_attempts=d.remaining_attempts,
                confidence=d.confidence,
                is_safe=d.is_safe,
            )
            session.add(db_d)

        for a in state.audit_trail:
            db_a = DBAuditEntry(
                id=a.id or f"aud_{uuid.uuid4().hex}",
                mandate_failure_id=a.mandate_failure_id,
                timestamp=a.timestamp,
                stage=a.stage,
                input_data=a.input_data,
                output_data=a.output_data,
                llm_used=a.llm_used,
                notes=a.notes,
            )
            session.add(db_a)

        session.commit()
