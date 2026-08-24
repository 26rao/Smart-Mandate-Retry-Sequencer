import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models import ActionType, AuditEntry, Decision, Diagnosis, MandateFailure


class SequencerState(BaseModel):
    failure: MandateFailure
    diagnosis: Optional[Diagnosis] = None
    decision: Optional[Decision] = None
    execution_result: Optional[Dict[str, Any]] = None
    audit_trail: List[AuditEntry] = Field(default_factory=list)
    current_stage: str = "detected"
    is_finished: bool = False
    error: Optional[str] = None

    def add_audit(
        self,
        stage: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        llm_used: bool = False,
        llm_model: Optional[str] = None,
        notes: Optional[str] = None,
    ):
        entry = AuditEntry(
            id=f"aud_{self.failure.id}_{stage}_{uuid.uuid4().hex[:6]}",
            timestamp=datetime.now(timezone.utc),
            mandate_failure_id=self.failure.id,
            stage=stage,
            input_data=input_data,
            output_data=output_data,
            llm_used=llm_used,
            llm_model=llm_model,
            notes=notes,
        )
        self.audit_trail.append(entry)
