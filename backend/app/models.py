from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class DeclineCategory(str, Enum):
    INSUFFICIENT_FUNDS = "insufficient_funds"
    TEMPORARY_BANK_ISSUE = "temporary_bank_issue"
    NETWORK_GLITCH = "network_glitch"
    CONSENT_WITHDRAWN = "consent_withdrawn"
    CARD_EXPIRED = "card_expired"
    ACCOUNT_CLOSED = "account_closed"
    LIMIT_EXCEEDED = "limit_exceeded"
    AUTHENTICATION_FAILED = "authentication_failed"
    MANDATE_INACTIVE = "mandate_inactive"
    GATEWAY_TIMEOUT = "gateway_timeout"
    FRAUD_SUSPECTED = "fraud_suspected"
    UNKNOWN = "unknown"


class ActionType(str, Enum):
    RETRY_NOW = "retry_now"
    SCHEDULE_RETRY = "schedule_retry"
    SUGGEST_METHOD_SWITCH = "suggest_method_switch"
    SOFT_NOTIFY = "soft_notify"
    ESCALATE = "escalate"
    HARD_STOP = "hard_stop"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SUCCESS = "success"
    FAILED = "failed"
    STOPPED = "stopped"
    ESCALATED = "escalated"


class MandateFailure(BaseModel):
    id: str
    payment_id: str
    mandate_id: str
    amount: int  # in paise
    currency: str = "INR"
    error_code: str
    error_reason: str
    error_source: str = "customer"
    error_step: str = "payment_authorization"
    error_description: str = ""
    customer_id: Optional[str] = None
    customer_persona: Optional[str] = None
    attempt_number: int = 1
    salary_day_of_month: Optional[int] = None
    payment_method: str = "upi_autopay"  # upi_autopay | card_recurring | emandate_netbanking
    is_terminal: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Diagnosis(BaseModel):
    category: DeclineCategory
    recoverability: float = Field(ge=0.0, le=1.0)
    recommended_action: ActionType
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_delay_hours: Optional[int] = None
    llm_model: Optional[str] = None
    raw_reasoning: Optional[str] = None


class Decision(BaseModel):
    mandate_failure_id: str
    action: ActionType
    regulatory_framework: str = "NPCI UPI Autopay (4-Attempt Bound)"
    payment_method: str = "upi_autopay"
    schedule_at: Optional[datetime] = None
    notice_sent_at: Optional[datetime] = None
    earliest_retry_at: Optional[datetime] = None
    is_non_peak_scheduled: bool = False
    expected_value_inr: Optional[float] = None
    attempt_cost_inr: float = 2.50
    razorpay_order_id: Optional[str] = None
    message_template: Optional[str] = None
    rationale: str
    remaining_attempts: int
    confidence: float
    is_safe: bool = True
    policy_clause: Optional[str] = None
    ev_calculation_breakdown: Optional[str] = None
    why_chosen: Optional[str] = None
    counterfactuals: Optional[List[Dict[str, Any]]] = None
    bank_holiday_delayed: bool = False
    afa_warning: Optional[str] = None


class AuditEntry(BaseModel):
    id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mandate_failure_id: str
    stage: str  # detect | diagnose | decide | execute | stop | escalate | ops_resolve
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    llm_used: bool = False
    llm_model: Optional[str] = None
    notes: Optional[str] = None
    prev_hash: Optional[str] = None
    row_hash: Optional[str] = None


# SQLAlchemy ORM definitions for SQLite persistence
class DBMandateFailure(Base):
    __tablename__ = "mandate_failures"

    id = Column(String, primary_key=True)
    payment_id = Column(String, index=True)
    mandate_id = Column(String, index=True)
    customer_id = Column(String, nullable=True)
    customer_persona = Column(String, nullable=True)
    amount = Column(Integer)  # in paise
    currency = Column(String, default="INR")
    payment_method = Column(String, default="upi_autopay")
    error_code = Column(String)
    error_reason = Column(String)
    error_source = Column(String)
    error_step = Column(String)
    error_description = Column(Text)
    attempt_number = Column(Integer, default=1)
    salary_day_of_month = Column(Integer, nullable=True)
    is_terminal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DBDecision(Base):
    __tablename__ = "decisions"

    id = Column(String, primary_key=True)
    mandate_failure_id = Column(String, index=True)
    action = Column(String)
    regulatory_framework = Column(String, default="NPCI UPI Autopay (4-Attempt Bound)")
    payment_method = Column(String, default="upi_autopay")
    schedule_at = Column(DateTime, nullable=True)
    notice_sent_at = Column(DateTime, nullable=True)
    earliest_retry_at = Column(DateTime, nullable=True)
    is_non_peak_scheduled = Column(Boolean, default=False)
    expected_value_inr = Column(Float, nullable=True)
    attempt_cost_inr = Column(Float, default=2.50)
    razorpay_order_id = Column(String, nullable=True)
    message_template = Column(Text, nullable=True)
    rationale = Column(Text)
    remaining_attempts = Column(Integer)
    confidence = Column(Float)
    is_safe = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DBAuditEntry(Base):
    __tablename__ = "audit_entries"

    id = Column(String, primary_key=True)
    mandate_failure_id = Column(String, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    stage = Column(String)
    input_data = Column(JSON)
    output_data = Column(JSON)
    llm_used = Column(Boolean, default=False)
    llm_model = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    prev_hash = Column(String, nullable=True)
    row_hash = Column(String, nullable=True)
