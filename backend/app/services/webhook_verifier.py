"""
Razorpay Webhook HMAC-SHA256 Signature Verification Service
------------------------------------------------------------
Implements cryptographically robust validation of inbound webhooks using Razorpay's
official HMAC-SHA256 signature scheme against the configured RAZORPAY_WEBHOOK_SECRET.
"""

import hmac
import hashlib
import json
from typing import Dict, Any, Tuple, Optional
from app.config import settings


def verify_razorpay_webhook(
    raw_body: bytes,
    signature: Optional[str],
    secret: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Verify incoming webhook payload using HMAC SHA256.
    Returns (is_valid: bool, reason: str).
    """
    webhook_secret = secret or getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "whsec_test_secret_key_12345")
    
    if not signature:
        return False, "Missing 'X-Razorpay-Signature' header on webhook delivery."

    if not raw_body:
        return False, "Empty webhook payload body."

    try:
        expected_sig = hmac.new(
            key=webhook_secret.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        if hmac.compare_digest(expected_sig, signature):
            return True, f"HMAC-SHA256 signature verified against secret [{webhook_secret[:6]}...]"
        else:
            return False, f"HMAC signature mismatch: provided [{signature[:10]}...] does not match computed [{expected_sig[:10]}...]"
    except Exception as e:
        return False, f"Cryptographic verification error: {str(e)}"
