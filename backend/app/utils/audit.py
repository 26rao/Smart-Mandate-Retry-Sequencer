import hashlib
import json
import uuid
from typing import Any, Dict, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session
from app.database import SyncSessionLocal, AsyncSessionLocal
from app.models import DBAuditEntry, DBDecision, DBMandateFailure
from app.agent.state import SequencerState

GENESIS_HASH = "0" * 64


def compute_row_hash(prev_hash: str, payload_dict: Dict[str, Any]) -> str:
    """Compute deterministic SHA-256 cryptographic hash for an audit ledger block."""
    canonical = json.dumps(payload_dict, sort_keys=True, separators=(",", ":"), default=str)
    combined = f"{prev_hash}:{canonical}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


async def save_sequencer_state_async(state: SequencerState):
    """Persist mandate failure, decision, and all audit logs asynchronously with SHA-256 chaining."""
    async with AsyncSessionLocal() as session:
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

        # Retrieve the latest audit row hash to maintain the chain
        latest_res = await session.execute(
            select(DBAuditEntry.row_hash).order_by(DBAuditEntry.timestamp.desc()).limit(1)
        )
        last_hash_row = latest_res.scalar()
        current_prev_hash = last_hash_row if last_hash_row else GENESIS_HASH

        for a in state.audit_trail:
            row_content = {
                "mandate_failure_id": a.mandate_failure_id,
                "stage": a.stage,
                "input_data": a.input_data,
                "output_data": a.output_data,
                "llm_used": a.llm_used,
                "llm_model": a.llm_model,
                "notes": a.notes,
            }
            row_hash = compute_row_hash(current_prev_hash, row_content)
            a.prev_hash = current_prev_hash
            a.row_hash = row_hash

            db_a = DBAuditEntry(
                id=a.id or f"aud_{uuid.uuid4().hex}",
                mandate_failure_id=a.mandate_failure_id,
                timestamp=a.timestamp,
                stage=a.stage,
                input_data=a.input_data,
                output_data=a.output_data,
                llm_used=a.llm_used,
                llm_model=a.llm_model,
                notes=a.notes,
                prev_hash=current_prev_hash,
                row_hash=row_hash,
            )
            session.add(db_a)
            current_prev_hash = row_hash

        await session.commit()


def save_sequencer_state_sync(state: SequencerState):
    """Persist mandate failure, decision, and all audit logs synchronously with SHA-256 chaining."""
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

        last_entry = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.desc()).first()
        current_prev_hash = last_entry.row_hash if last_entry and last_entry.row_hash else GENESIS_HASH

        for a in state.audit_trail:
            row_content = {
                "mandate_failure_id": a.mandate_failure_id,
                "stage": a.stage,
                "input_data": a.input_data,
                "output_data": a.output_data,
                "llm_used": a.llm_used,
                "llm_model": a.llm_model,
                "notes": a.notes,
            }
            row_hash = compute_row_hash(current_prev_hash, row_content)
            a.prev_hash = current_prev_hash
            a.row_hash = row_hash

            db_a = DBAuditEntry(
                id=a.id or f"aud_{uuid.uuid4().hex}",
                mandate_failure_id=a.mandate_failure_id,
                timestamp=a.timestamp,
                stage=a.stage,
                input_data=a.input_data,
                output_data=a.output_data,
                llm_used=a.llm_used,
                llm_model=a.llm_model,
                notes=a.notes,
                prev_hash=current_prev_hash,
                row_hash=row_hash,
            )
            session.add(db_a)
            current_prev_hash = row_hash

        session.commit()


def verify_audit_chain_sync() -> Dict[str, Any]:
    """Cryptographically verify the SHA-256 integrity of the entire audit ledger."""
    with SyncSessionLocal() as session:
        entries = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.asc()).all()

    if not entries:
        return {
            "status": "verified",
            "total_blocks": 0,
            "chain_valid": True,
            "message": "Audit ledger is clean and empty.",
            "tampered_rows": [],
        }

    expected_prev = GENESIS_HASH
    tampered = []

    for i, entry in enumerate(entries):
        row_content = {
            "mandate_failure_id": entry.mandate_failure_id,
            "stage": entry.stage,
            "input_data": entry.input_data,
            "output_data": entry.output_data,
            "llm_used": entry.llm_used,
            "llm_model": entry.llm_model,
            "notes": entry.notes,
        }
        recomputed = compute_row_hash(entry.prev_hash or expected_prev, row_content)

        if entry.prev_hash and entry.prev_hash != expected_prev and i > 0:
            tampered.append({"id": entry.id, "reason": "prev_hash mismatch"})

        if entry.row_hash and entry.row_hash != recomputed:
            tampered.append({"id": entry.id, "reason": "row_hash mismatch"})

        expected_prev = entry.row_hash or recomputed

    is_valid = len(tampered) == 0
    return {
        "status": "verified" if is_valid else "tampered",
        "total_blocks": len(entries),
        "chain_valid": is_valid,
        "tampered_rows": tampered,
        "message": f"Cryptographic audit chain verified across {len(entries)} immutable blocks. 0 anomalies detected." if is_valid else f"Audit chain integrity check failed on {len(tampered)} rows.",
    }


def append_audit_entry_sync(entry: Any) -> DBAuditEntry:
    """Append a single standalone audit entry (e.g. Ops override) with valid SHA-256 hash chaining."""
    with SyncSessionLocal() as session:
        last_entry = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.desc()).first()
        current_prev_hash = last_entry.row_hash if last_entry and last_entry.row_hash else GENESIS_HASH

        row_content = {
            "mandate_failure_id": getattr(entry, "mandate_failure_id", "unknown"),
            "stage": getattr(entry, "stage", "ops_resolve"),
            "input_data": getattr(entry, "input_data", {}),
            "output_data": getattr(entry, "output_data", {}),
            "llm_used": getattr(entry, "llm_used", False),
            "llm_model": getattr(entry, "llm_model", None),
            "notes": getattr(entry, "notes", ""),
        }
        row_hash = compute_row_hash(current_prev_hash, row_content)

        db_a = DBAuditEntry(
            id=getattr(entry, "id", None) or f"aud_{uuid.uuid4().hex}",
            mandate_failure_id=row_content["mandate_failure_id"],
            stage=row_content["stage"],
            input_data=row_content["input_data"],
            output_data=row_content["output_data"],
            llm_used=row_content["llm_used"],
            llm_model=row_content["llm_model"],
            notes=row_content["notes"],
            prev_hash=current_prev_hash,
            row_hash=row_hash,
        )
        session.add(db_a)
        session.commit()
        session.refresh(db_a)
        return db_a
