import pytest
from app.models import ActionType, DeclineCategory
from app.taxonomy import classify_error_sync


def test_classify_insufficient_funds():
    diag = classify_error_sync(
        error_code="BAD_REQUEST_ERROR",
        error_reason="insufficient_funds",
        error_description="Account balance lower than transaction amount.",
    )
    assert diag.category == DeclineCategory.INSUFFICIENT_FUNDS
    assert diag.recoverability >= 0.8
    assert diag.recommended_action == ActionType.SCHEDULE_RETRY


def test_classify_consent_withdrawn():
    diag = classify_error_sync(
        error_code="BAD_REQUEST_ERROR",
        error_reason="mandate_cancelled_by_customer",
        error_description="Customer revoked recurring mandate.",
    )
    assert diag.category == DeclineCategory.CONSENT_WITHDRAWN
    assert diag.recoverability == 0.0
    assert diag.recommended_action == ActionType.HARD_STOP


def test_classify_card_expired():
    diag = classify_error_sync(
        error_code="BAD_REQUEST_ERROR",
        error_reason="card_expired",
        error_description="Card validity expired.",
    )
    assert diag.category == DeclineCategory.CARD_EXPIRED
    assert diag.recommended_action == ActionType.SUGGEST_METHOD_SWITCH


def test_classify_network_glitch():
    diag = classify_error_sync(
        error_code="NETWORK_ERROR",
        error_reason="network_timeout",
        error_description="Socket timeout during authorization.",
    )
    assert diag.category == DeclineCategory.NETWORK_GLITCH
    assert diag.recommended_action == ActionType.RETRY_NOW


def test_classify_unknown_fallback():
    diag = classify_error_sync(
        error_code="WEIRD_CUSTOM_ERROR",
        error_reason="unseen_reason_xyz",
        error_description="Something unspecified happened.",
    )
    assert diag.category == DeclineCategory.UNKNOWN
    assert diag.recommended_action == ActionType.ESCALATE
