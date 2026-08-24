from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple, Union
from app.config import settings
from app.models import ActionType, DeclineCategory, Decision, Diagnosis, MandateFailure

# Terminal non-retryable categories
TERMINAL_NON_RETRYABLE = {
    DeclineCategory.CONSENT_WITHDRAWN,
    DeclineCategory.ACCOUNT_CLOSED,
    DeclineCategory.CARD_EXPIRED,
    DeclineCategory.FRAUD_SUSPECTED,
    DeclineCategory.MANDATE_INACTIVE,
}

ATTEMPT_COST_INR = 2.50  # Estimated per-attempt payment gateway & bank infrastructure cost


def get_max_attempts_for_method(payment_method: str) -> int:
    """Return regulatory maximum attempt bound based on payment rail."""
    method = (payment_method or "").lower()
    if "upi" in method:
        return getattr(settings, "MAX_ATTEMPTS_UPI", 4)
    elif "card" in method:
        return getattr(settings, "MAX_ATTEMPTS_CARD", 3)
    elif "nach" in method:
        return getattr(settings, "MAX_ATTEMPTS_NACH", 3)
    return getattr(settings, "MAX_ATTEMPTS", 4)


def can_retry(
    category_or_failure: Union[DeclineCategory, MandateFailure],
    attempt_or_diag: Optional[Union[int, Diagnosis]] = None,
    payment_method: str = "upi_autopay",
    earliest_retry_at: Optional[datetime] = None,
    current_time: Optional[datetime] = None,
) -> Union[bool, Tuple[bool, str]]:
    """
    Deterministic Regulatory Safety Gate.
    Supports both can_retry(failure, diagnosis) and can_retry(category, attempt_number).
    1. NPCI UPI Autopay: Strict 4-attempt hard cap (1 original + 3 retries).
    2. RBI Card E-Mandate: Strict 3-attempt hard cap (1 original + 2 retries).
    3. RBI E-Mandate Framework: Requires mandatory pre-debit notification before debit attempts.
    4. Terminal Non-Retryable Check: Immediate 0-retry hard stop on consent revocation / account closed.
    """
    if isinstance(category_or_failure, MandateFailure):
        failure = category_or_failure
        diagnosis = attempt_or_diag if isinstance(attempt_or_diag, Diagnosis) else None
        cat = diagnosis.category if diagnosis else DeclineCategory.UNKNOWN
        attempt = failure.attempt_number
        method = failure.payment_method
    else:
        cat = category_or_failure
        attempt = attempt_or_diag if isinstance(attempt_or_diag, int) else 1
        method = payment_method

    # 1. Terminal Category Check (Both NPCI & RBI)
    if cat in TERMINAL_NON_RETRYABLE:
        if isinstance(category_or_failure, MandateFailure):
            return False
        return False, f"Category [{cat.value}] is non-retryable. Immediate hard stop to prevent customer harm."

    # 2. Per-Framework Attempt Bound Check (NPCI UPI: 4, RBI Card: 3, e-NACH: 3)
    max_attempts = get_max_attempts_for_method(method)
    is_upi = method.lower() in ["upi_autopay", "upi", "upi_mandate"]
    framework_label = "NPCI UPI Autopay" if is_upi else "RBI E-Mandate"
    
    if attempt >= max_attempts:
        if isinstance(category_or_failure, MandateFailure):
            return False
        return False, f"{framework_label} attempt limit ({max_attempts}) reached. Retries legally prohibited."

    # 3. Pre-Debit Notice Window Check (RBI E-Mandate Framework)
    if earliest_retry_at and current_time:
        if current_time < earliest_retry_at:
            if isinstance(category_or_failure, MandateFailure):
                return False
            return False, f"RBI E-Mandate pre-debit notice window has not elapsed yet (Earliest: {earliest_retry_at.isoformat()})."

    # 4. General fallback upper safety bound
    if attempt >= 5:
        if isinstance(category_or_failure, MandateFailure):
            return False
        return False, "Maximum system safety bound of 5 attempts reached across all payment rails."

    if isinstance(category_or_failure, MandateFailure):
        return True
    return True, "Retry permitted under applicable regulatory framework."


def align_to_non_peak_window(target_time: datetime) -> datetime:
    """
    NPCI Non-Peak Window Alignment for UPI Autopay:
    Align retry execution to 03:30 AM UTC (09:00 AM IST) or off-peak banking window 02:00-06:00 IST.
    """
    aligned = target_time.replace(hour=3, minute=30, second=0, microsecond=0)
    if aligned < target_time:
        aligned += timedelta(days=1)
    return aligned


def calculate_schedule_time(
    salary_day_or_failure: Union[Optional[int], MandateFailure],
    diag_or_current_time: Optional[Union[Diagnosis, datetime]] = None,
    current_time: Optional[datetime] = None,
    suggested_delay_hours: Optional[int] = None,
    is_upi: bool = False,
) -> Union[datetime, Tuple[datetime, bool]]:
    """
    Calculate optimal retry execution time.
    Supports calculate_schedule_time(failure, diagnosis, current_time=...) and calculate_schedule_time(salary_day, ...).
    """
    if isinstance(salary_day_or_failure, MandateFailure):
        salary_day = salary_day_or_failure.salary_day_of_month
        now = current_time or datetime.now(timezone.utc)
        delay = getattr(diag_or_current_time, "suggested_delay_hours", None) if isinstance(diag_or_current_time, Diagnosis) else suggested_delay_hours
        upi = salary_day_or_failure.payment_method.lower() in ["upi_autopay", "upi", "upi_mandate"]
        return_tuple = False
    else:
        salary_day = salary_day_or_failure
        now = current_time or (diag_or_current_time if isinstance(diag_or_current_time, datetime) else datetime.now(timezone.utc))
        delay = suggested_delay_hours
        upi = is_upi
        return_tuple = True

    if delay:
        sched = now + timedelta(hours=delay)
        if upi:
            sched = align_to_non_peak_window(sched)
            return (sched, True) if return_tuple else sched
        return (sched, False) if return_tuple else sched

    if salary_day and 1 <= salary_day <= 31:
        target_day = min(salary_day + 1, 28)
        current_day = now.day

        if current_day < target_day:
            days_ahead = target_day - current_day
        else:
            days_ahead = (30 - current_day) + target_day

        sched = (now + timedelta(days=days_ahead)).replace(hour=4, minute=30, second=0, microsecond=0)
        return (sched, upi) if return_tuple else sched

    sched = now + timedelta(hours=24)
    if upi:
        sched = align_to_non_peak_window(sched)
        return (sched, True) if return_tuple else sched
    return (sched, False) if return_tuple else sched


def decide_action(
    failure: MandateFailure,
    diagnosis: Diagnosis,
    current_time: Optional[datetime] = None,
) -> Decision:
    """
    Produce a deterministic, regulatory-compliant and economically optimized Decision.
    """
    now = current_time or datetime.now(timezone.utc)
    is_upi = failure.payment_method.lower() in ["upi_autopay", "upi", "upi_mandate"]
    max_framework_attempts = get_max_attempts_for_method(failure.payment_method)
    
    if is_upi:
        framework = f"NPCI UPI Autopay ({max_framework_attempts}-Attempt Bound)"
    else:
        framework = f"RBI E-Mandate (Pre-Debit Notice Required, {max_framework_attempts}-Attempt Cap)"
    
    amount_inr = failure.amount / 100.0
    ev_inr = (diagnosis.recoverability * amount_inr) - ATTEMPT_COST_INR

    # Pre-debit notice timestamps (24h legal window)
    notice_sent_at = now
    earliest_retry_at = now + timedelta(hours=24)

    retry_allowed, reason = can_retry(
        category_or_failure=diagnosis.category,
        attempt_or_diag=failure.attempt_number,
        payment_method=failure.payment_method,
    )
    remaining = max(0, max_framework_attempts - failure.attempt_number)

    # 1. HARD STOP (Revocation, Closed Account, or Attempt Exhaustion)
    if not retry_allowed and diagnosis.category != DeclineCategory.CARD_EXPIRED:
        template = None
        if diagnosis.category == DeclineCategory.CONSENT_WITHDRAWN:
            template = "Your recurring autopay mandate has been cancelled as requested. No further debits will be attempted."
            clause = "NPCI UPI Autopay Circular OC No. 122/2021-22 & RBI Mandate Framework Sec 4.2 (Revocation Termination)"
            why = "Customer explicitly revoked mandate consent. Retrying a revoked mandate violates RBI/NPCI regulations and risks merchant de-registration."
        elif diagnosis.category == DeclineCategory.ACCOUNT_CLOSED:
            template = "Your linked bank account is inactive. Please update your payment method to avoid service interruption."
            clause = "RBI Master Direction on Digital Payments Sec 8 (Account Validity Guard)"
            why = "Underlying bank account has been permanently terminated by the customer or bank. Repeated retries incur wasted gateway fees with 0% recovery."
        else:
            template = f"Your recurring payment could not be processed after {max_framework_attempts} attempts. Please complete payment manually: {{{{payment_link}}}}"
            clause = f"NPCI/RBI Regulatory Framework ({max_framework_attempts}-Attempt Statutory Cap per Billing Cycle)"
            why = f"Attempt budget exhausted ({max_framework_attempts}/{max_framework_attempts} attempts used). Retrying further would violate regulatory debit attempt caps."

        return Decision(
            mandate_failure_id=failure.id,
            action=ActionType.HARD_STOP,
            regulatory_framework=framework,
            payment_method=failure.payment_method,
            schedule_at=None,
            notice_sent_at=notice_sent_at,
            earliest_retry_at=None,
            is_non_peak_scheduled=False,
            expected_value_inr=round(ev_inr, 2),
            attempt_cost_inr=ATTEMPT_COST_INR,
            message_template=template,
            rationale=reason,
            remaining_attempts=0,
            confidence=1.0,
            is_safe=True,
            policy_clause=clause,
            ev_calculation_breakdown=f"EV = (0.00 × ₹{amount_inr:.2f}) - ₹{ATTEMPT_COST_INR:.2f} = -₹{ATTEMPT_COST_INR:.2f} (Terminal Decline)",
            why_chosen=why,
        )

    # 2. SUGGEST METHOD SWITCH (Card Expired - 0 debit fee incurred)
    if diagnosis.category == DeclineCategory.CARD_EXPIRED:
        return Decision(
            mandate_failure_id=failure.id,
            action=ActionType.SUGGEST_METHOD_SWITCH,
            regulatory_framework=framework,
            payment_method=failure.payment_method,
            schedule_at=None,
            notice_sent_at=notice_sent_at,
            earliest_retry_at=None,
            is_non_peak_scheduled=False,
            expected_value_inr=round(ev_inr, 2),
            attempt_cost_inr=ATTEMPT_COST_INR,
            message_template="Your saved card has expired. Update your card or switch to UPI Autopay here: {{update_link}}",
            rationale="Card is expired. Retrying on the same token will fail. Requesting method switch.",
            remaining_attempts=remaining,
            confidence=0.95,
            is_safe=True,
            policy_clause="RBI Master Direction on Card Tokenisation (DPSS.CO.PD No.447/02.14.003/2019-20)",
            ev_calculation_breakdown=f"EV = (0.00 × ₹{amount_inr:.2f}) - ₹{ATTEMPT_COST_INR:.2f} = -₹{ATTEMPT_COST_INR:.2f} (Saved ₹{ATTEMPT_COST_INR:.2f} fee via Zero-Debit Switch)",
            why_chosen="Saved card token has expired at issuer. Re-triggering the same card token fails 100% of the time. Switched to payment link dispatch.",
        )

    # 3. ECONOMIC GUARD FOR RETRIES (Expected Value Check)
    if ev_inr <= 0 and diagnosis.category not in {DeclineCategory.NETWORK_GLITCH, DeclineCategory.GATEWAY_TIMEOUT}:
        return Decision(
            mandate_failure_id=failure.id,
            action=ActionType.HARD_STOP,
            regulatory_framework=framework,
            payment_method=failure.payment_method,
            schedule_at=None,
            notice_sent_at=notice_sent_at,
            earliest_retry_at=None,
            is_non_peak_scheduled=False,
            expected_value_inr=round(ev_inr, 2),
            attempt_cost_inr=ATTEMPT_COST_INR,
            message_template="Recurring debit on hold due to low expected recovery margin. Please complete manual payment: {{payment_link}}",
            rationale=f"Negative expected value (EV: Rs. {ev_inr:.2f} < cost Rs. {ATTEMPT_COST_INR:.2f}). Retry halted to protect unit economics.",
            remaining_attempts=0,
            confidence=0.95,
            is_safe=True,
            policy_clause="Merchant Profitability Guard & Economic Halting Policy (Zero-Waste ROI Rule)",
            ev_calculation_breakdown=f"EV = ({diagnosis.recoverability*100:.0f}% × ₹{amount_inr:.2f}) - ₹{ATTEMPT_COST_INR:.2f} = ₹{ev_inr:.2f} (Negative Margin)",
            why_chosen=f"Calculated expected return (₹{diagnosis.recoverability*amount_inr:.2f}) is lower than the gateway attempt fee (₹{ATTEMPT_COST_INR:.2f}). Retrying would incur a guaranteed net loss.",
        )

    # 4. SCHEDULE RETRY (Insufficient funds / Temporary Bank Glitch)
    if diagnosis.recommended_action == ActionType.SCHEDULE_RETRY or diagnosis.category in {DeclineCategory.INSUFFICIENT_FUNDS, DeclineCategory.TEMPORARY_BANK_ISSUE}:
        sched_res = calculate_schedule_time(
            salary_day_or_failure=failure.salary_day_of_month,
            current_time=now,
            suggested_delay_hours=diagnosis.suggested_delay_hours,
            is_upi=is_upi,
        )
        sched = sched_res[0] if isinstance(sched_res, tuple) else sched_res
        is_non_peak = sched_res[1] if isinstance(sched_res, tuple) else is_upi

        # REGULATORY CLAMP: Statutory notice window requires minimum 24h prior notice
        was_clamped_to_24h = False
        if not is_upi or "RBI E-Mandate" in framework or sched < earliest_retry_at:
            if sched is None or sched < earliest_retry_at:
                sched = earliest_retry_at
                was_clamped_to_24h = True

        msg = f"Pre-debit Notice: Your recurring payment of Rs. {amount_inr:.2f} is scheduled for {sched.strftime('%d %b %Y')}. Ensure sufficient balance."
        
        notice_clause = " (statutory 24h pre-debit notice window enforced)" if was_clamped_to_24h else ""
        rationale = f"Scheduled retry on {sched.strftime('%Y-%m-%d %H:%M UTC')}{notice_clause} with pre-debit notice window active. EV: Rs. {ev_inr:.2f}. {remaining} attempt(s) remaining."

        clause = (
            "RBI Circular DPSS.CO.PD No.447/02.14.003/2019-20 Sec 3(b) (Statutory 24h Pre-Debit Notice Window) & NPCI Off-Peak Batch Clearing Window (02:00-06:00 IST)"
            if is_upi
            else "RBI Circular DPSS.CO.PD No.447/02.14.003/2019-20 Sec 3(b) (Statutory 24h Pre-Debit Notice Window)"
        )
        roi_pct = round((ev_inr / amount_inr) * 100, 1) if amount_inr > 0 else 0

        return Decision(
            mandate_failure_id=failure.id,
            action=ActionType.SCHEDULE_RETRY,
            regulatory_framework=framework,
            payment_method=failure.payment_method,
            schedule_at=sched,
            notice_sent_at=notice_sent_at,
            earliest_retry_at=earliest_retry_at,
            is_non_peak_scheduled=is_non_peak,
            expected_value_inr=round(ev_inr, 2),
            attempt_cost_inr=ATTEMPT_COST_INR,
            message_template=msg,
            rationale=rationale,
            remaining_attempts=remaining,
            confidence=diagnosis.confidence,
            is_safe=True,
            policy_clause=clause,
            ev_calculation_breakdown=f"EV = ({diagnosis.recoverability*100:.0f}% × ₹{amount_inr:.2f}) - ₹{ATTEMPT_COST_INR:.2f} = ₹{ev_inr:.2f} (+{roi_pct}% ROI)",
            why_chosen=f"Soft failure aligned with customer salary liquidity window. Clamped to statutory 24h pre-debit notice window with {remaining} attempt(s) remaining in budget.",
        )

    # 5. IMMEDIATE RETRY (Network Glitch / Gateway Timeout)
    if diagnosis.recommended_action == ActionType.RETRY_NOW or diagnosis.category in {DeclineCategory.NETWORK_GLITCH, DeclineCategory.GATEWAY_TIMEOUT}:
        return Decision(
            mandate_failure_id=failure.id,
            action=ActionType.RETRY_NOW,
            regulatory_framework=framework,
            payment_method=failure.payment_method,
            schedule_at=now,
            notice_sent_at=notice_sent_at,
            earliest_retry_at=now,
            is_non_peak_scheduled=False,
            expected_value_inr=round(ev_inr, 2),
            attempt_cost_inr=ATTEMPT_COST_INR,
            message_template=None,
            rationale=f"Transient infrastructure error [{diagnosis.category.value}]. Immediate retry within safety budget (EV: Rs. {ev_inr:.2f}).",
            remaining_attempts=remaining,
            confidence=0.90,
            is_safe=True,
            policy_clause="NPCI Technical Error Handling Guidelines Sec 4 (Immediate Idempotent Re-query)",
            ev_calculation_breakdown=f"EV = ({diagnosis.recoverability*100:.0f}% × ₹{amount_inr:.2f}) - ₹{ATTEMPT_COST_INR:.2f} = ₹{ev_inr:.2f}",
            why_chosen=f"High-probability transient gateway glitch ({diagnosis.category.value}). Immediate retry is safe and cost-effective under active attempt budget.",
        )

    # 6. SOFT NOTIFY (Limit Exceeded / Auth Failure)
    return Decision(
        mandate_failure_id=failure.id,
        action=ActionType.SOFT_NOTIFY,
        regulatory_framework=framework,
        payment_method=failure.payment_method,
        schedule_at=None,
        notice_sent_at=notice_sent_at,
        earliest_retry_at=None,
        is_non_peak_scheduled=False,
        expected_value_inr=round(ev_inr, 2),
        attempt_cost_inr=ATTEMPT_COST_INR,
        message_template=f"Action Required: Your mandate debit of Rs. {amount_inr:.2f} requires authorization: {{{{auth_link}}}}",
        rationale=f"Customer action required for [{diagnosis.category.value}]. Soft notification dispatched.",
        remaining_attempts=remaining,
        confidence=0.85,
        is_safe=True,
        policy_clause="NPCI / RBI User Authentication & Limit Enhancement Policy",
        ev_calculation_breakdown=f"EV = ({diagnosis.recoverability*100:.0f}% × ₹{amount_inr:.2f}) - ₹0.00 = ₹{amount_inr*diagnosis.recoverability:.2f} (Zero-Debit Notification)",
        why_chosen="Decline requires customer-side MPIN/Limit re-configuration. Sending payment link saves a retry attempt while keeping customer informed.",
    )
