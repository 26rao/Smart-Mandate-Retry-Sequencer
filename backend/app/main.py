import json
import os
import uuid
import io
import csv
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import init_db, get_db
from app.models import (
    MandateFailure,
    Diagnosis,
    Decision,
    AuditEntry,
    DBMandateFailure,
    DBDecision,
    DBAuditEntry,
)
from app.taxonomy import TAXONOMY_MAP, classify_error_sync
from app.agent.graph import sequencer_agent
from app.utils.audit import save_sequencer_state_async
from app.simulator.generator import generate_synthetic_failures, export_sample_failures_json
from app.services.razorpay_client import razorpay_service
from app.utils.metrics import evaluator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    await init_db()
    # Generate sample failures file if it doesn't exist
    if not os.path.exists("data/sample_failures.json"):
        export_sample_failures_json()
    yield


app = FastAPI(
    title="Razorpay Smart Mandate Retry Sequencer",
    description="Agentic, safety-first mandate retry sequencer with deterministic policy layer, Groq classification, and real Razorpay test-mode SDK.",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Ensure all unhandled exceptions return 500 JSON with CORS headers."""
    import logging
    logging.getLogger("razorpay_sequencer").error(f"Global unhandled exception on {request.url}: {exc}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


class OpsResolveRequest(BaseModel):
    mandate_failure_id: str
    resolution_notes: str
    operator_id: str = "ops_analyst_01"
    status_override: str = "resolved"


@app.post("/api/v1/ops/resolve")
async def resolve_escalated_mandate(req: OpsResolveRequest):
    """Operations queue action: mark an escalated or hard-stopped mandate resolved with audit hash chaining."""
    from app.database import SyncSessionLocal
    from app.models import DBAuditEntry
    from app.utils.audit import compute_row_hash, GENESIS_HASH

    with SyncSessionLocal() as session:
        last_entry = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.desc()).first()
        prev_hash = last_entry.row_hash if last_entry and last_entry.row_hash else GENESIS_HASH

        audit_payload = {
            "mandate_failure_id": req.mandate_failure_id,
            "stage": "ops_resolve",
            "input_data": {"operator_id": req.operator_id, "resolution": req.status_override},
            "output_data": {"status": "resolved", "notes": req.resolution_notes},
            "llm_used": False,
            "llm_model": None,
            "notes": f"Manual Operator Intervention by [{req.operator_id}]: {req.resolution_notes}",
        }
        row_hash = compute_row_hash(prev_hash, audit_payload)

        db_entry = DBAuditEntry(
            id=f"aud_ops_{uuid.uuid4().hex[:8]}",
            mandate_failure_id=req.mandate_failure_id,
            timestamp=datetime.now(timezone.utc),
            stage="ops_resolve",
            input_data=audit_payload["input_data"],
            output_data=audit_payload["output_data"],
            llm_used=False,
            notes=audit_payload["notes"],
            prev_hash=prev_hash,
            row_hash=row_hash,
        )
        session.add(db_entry)
        session.commit()

    return {
        "status": "success",
        "mandate_failure_id": req.mandate_failure_id,
        "action": "ops_resolve",
        "row_hash": row_hash,
        "message": f"Mandate [{req.mandate_failure_id}] successfully marked resolved by {req.operator_id}.",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "razorpay-smart-mandate-sequencer",
        "version": "1.2.0",
        "mode": "LIVE" if not settings.DRY_RUN else "DRY_RUN",
        "llm_provider": settings.LLM_PROVIDER,
        "groq_model": settings.GROQ_MODEL,
        "dry_run": settings.DRY_RUN,
        "max_attempts": settings.MAX_ATTEMPTS,
        "regulatory_frameworks": [
            "NPCI UPI Autopay (4-Attempt Bound)",
            "RBI E-Mandate (Pre-Debit Notice Required)",
        ],
        "razorpay_configured": bool(settings.RAZORPAY_KEY_ID and not settings.RAZORPAY_KEY_ID.startswith("rzp_test_mock")),
    }


@app.get("/api/v1/audit/verify")
async def verify_audit_ledger():
    """Cryptographically verify the SHA-256 hash-chain integrity of the SQLite audit ledger."""
    from app.utils.audit import verify_audit_chain_sync
    return verify_audit_chain_sync()


@app.get("/api/v1/audit/export")
async def export_audit_ledger(format: str = "csv"):
    """Export compliance audit ledger as CSV with cryptographic integrity verification header."""
    from app.database import SyncSessionLocal
    from app.models import DBAuditEntry
    from app.utils.audit import verify_audit_chain_sync
    import io
    import csv
    from fastapi.responses import Response

    verification = verify_audit_chain_sync()
    
    with SyncSessionLocal() as session:
        entries = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.asc()).all()

    output = io.StringIO()
    # Write cryptographic integrity stamp at top of file
    output.write(f"# --- RAZORPAY SMART SEQUENCER IMMUTABLE AUDIT TRAIL ---\n")
    output.write(f"# Cryptographic Verification: {'PASS' if verification['chain_valid'] else 'FAIL'}\n")
    output.write(f"# Total Blocks Verified: {verification['total_blocks']}\n")
    output.write(f"# Verification Status: {verification['message']}\n")
    output.write(f"# Export Timestamp UTC: {datetime.now(timezone.utc).isoformat()}\n")
    output.write(f"# ------------------------------------------------------\n")

    writer = csv.writer(output)
    writer.writerow([
        "id",
        "timestamp_utc",
        "mandate_failure_id",
        "stage",
        "llm_used",
        "llm_model",
        "prev_hash",
        "row_hash",
        "notes",
        "output_summary",
    ])

    for e in entries:
        writer.writerow([
            e.id,
            e.timestamp.isoformat() if e.timestamp else "",
            e.mandate_failure_id,
            e.stage,
            "TRUE" if e.llm_used else "FALSE",
            e.llm_model or "N/A",
            e.prev_hash or "genesis",
            e.row_hash or "",
            e.notes or "",
            json.dumps(e.output_data) if e.output_data else "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=razorpay_audit_ledger_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"},
    )


@app.get("/api/v1/payloads/real")
async def get_real_error_payloads():
    """Retrieve curated real Razorpay error payloads from data/real_error_payloads.json."""
    candidates = ["data/real_error_payloads.json", "../data/real_error_payloads.json"]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return []


@app.get("/api/v1/sequencer/taxonomy")
async def get_taxonomy():
    """Retrieve full taxonomy mapping table."""
    serialized = {}
    for (code, reason), val in TAXONOMY_MAP.items():
        serialized[f"{code}::{reason}"] = {
            "category": val["category"].value,
            "recoverability": val["recoverability"],
            "default_action": val["default_action"].value,
            "reason": val["reason"],
            "suggested_delay_hours": val.get("suggested_delay_hours"),
        }
    return {"taxonomy": serialized, "total_patterns": len(serialized)}


@app.post("/api/v1/sequencer/process")
async def process_mandate_failure(failure: MandateFailure):
    """Process a single mandate decline through the sequencer FSM."""
    try:
        state = await sequencer_agent.run(failure)
        await save_sequencer_state_async(state)
        return {
            "mandate_failure_id": failure.id,
            "diagnosis": state.diagnosis,
            "decision": state.decision,
            "execution_result": state.execution_result,
            "audit_trail": state.audit_trail,
            "audit_trail_count": len(state.audit_trail),
            "current_stage": state.current_stage,
            "is_finished": state.is_finished,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sequencer/batch")
async def process_batch_failures(failures: List[MandateFailure]):
    """Process a batch of mandate failures."""
    states = await sequencer_agent.run_batch(failures)
    for state in states:
        await save_sequencer_state_async(state)
    comparison = evaluator.compare(failures, states)
    return {
        "processed_count": len(states),
        "comparison_summary": comparison,
    }


@app.get("/api/v1/sequencer/benchmark")
async def run_benchmark(count: int = 250, seed: int = 42):
    """Run comparative benchmark against naive calendar retries."""
    failures = generate_synthetic_failures(count=count, seed=seed)
    states = await sequencer_agent.run_batch(failures)
    return evaluator.compare(failures, states)


@app.post("/api/v1/razorpay/test-order")
async def create_test_order(payload: Dict[str, Any]):
    """Create a real test order using Razorpay Test-Mode SDK with strict idempotency."""
    amount = payload.get("amount", 249900)
    currency = payload.get("currency", "INR")
    res = razorpay_service.create_retry_order(
        amount=amount,
        currency=currency,
        payment_id=payload.get("payment_id"),
        mandate_id=payload.get("mandate_id"),
        notes=payload.get("notes"),
        mandate_failure_id=payload.get("mandate_failure_id") or payload.get("id"),
        attempt_number=payload.get("attempt_number", 1),
    )
    return res


@app.get("/api/v1/audit/logs")
async def get_audit_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Retrieve recent SQLite audit ledger logs."""
    result = await db.execute(select(DBAuditEntry).order_by(DBAuditEntry.timestamp.desc()).limit(limit))
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "mandate_failure_id": r.mandate_failure_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "stage": r.stage,
            "input_data": r.input_data,
            "output_data": r.output_data,
            "llm_used": r.llm_used,
            "llm_model": r.llm_model,
            "prev_hash": r.prev_hash,
            "row_hash": r.row_hash,
            "notes": r.notes,
        }
        for r in rows
    ]

