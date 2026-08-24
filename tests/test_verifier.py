import pytest
from app.utils.verifier import independent_verifier
from app.services.webhook_verifier import verify_razorpay_webhook


def test_independent_compliance_verifier():
    """Verify that independent brute-force auditor runs without errors and validates rules."""
    res = independent_verifier.verify_ledger_records(limit=50)
    assert res["status"] == "PASS"
    assert "assertions" in res
    assert res["assertions"]["npci_upi_attempt_cap"]["passed"] is True
    assert res["assertions"]["rbi_card_attempt_cap"]["passed"] is True
    assert res["assertions"]["statutory_24h_notice_window"]["passed"] is True


def test_webhook_hmac_sha256_verification():
    """Verify HMAC SHA-256 signature verification logic for Razorpay webhooks."""
    secret = "whsec_test_secret_12345"
    raw_body = b'{"event":"payment.failed","payload":{"payment":{"entity":{"id":"pay_123"}}}}'
    
    import hmac
    import hashlib
    valid_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    
    is_valid, msg = verify_razorpay_webhook(raw_body, valid_sig, secret)
    assert is_valid is True
    
    is_invalid, msg_inv = verify_razorpay_webhook(raw_body, "invalid_signature_abc", secret)
    assert is_invalid is False
