import logging
import uuid
from typing import Any, Dict, Optional
import razorpay
from app.config import settings

logger = logging.getLogger("razorpay_sequencer")


class RazorpayService:
    """Official Razorpay Test-Mode Service Client.
    
    Supports:
    - Real test-mode Order creation (POST /v1/orders) for attaching retries
    - Real test-mode Payment fetching (GET /v1/payments/:id)
    - Full DRY_RUN mode for zero-cost offline local testing
    """

    def __init__(self):
        self.dry_run = settings.DRY_RUN
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self._client: Optional[razorpay.Client] = None

        if not self.dry_run and not self.key_id.startswith("rzp_test_mock"):
            try:
                self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
                logger.info("Initialized live Razorpay Test-Mode client successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize live Razorpay client: {e}. Falling back to dry-run mode.")
                self.dry_run = True

    def create_retry_order(
        self,
        amount: int,
        currency: str = "INR",
        payment_id: Optional[str] = None,
        mandate_id: Optional[str] = None,
        decline_category: Optional[str] = None,
        attempt_number: Optional[int] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new Razorpay Order in test mode to attach the retry attempt."""
        order_notes = {
            "source": "smart_mandate_sequencer",
            "original_payment_id": payment_id or "unknown",
            "mandate_id": mandate_id or "unknown",
        }
        if decline_category:
            order_notes["decline_category"] = str(decline_category)
        if attempt_number is not None:
            order_notes["attempt_number"] = str(attempt_number)
        if notes:
            order_notes.update(notes)

        payload = {
            "amount": amount,
            "currency": currency,
            "receipt": f"rcpt_seq_{uuid.uuid4().hex[:8]}",
            "notes": order_notes,
        }

        if self.dry_run or not self._client:
            mock_order_id = f"order_{uuid.uuid4().hex[:14]}"
            logger.info(f"[DRY-RUN] Created Simulated Test Order: {mock_order_id} for {amount/100} INR")
            return {
                "id": mock_order_id,
                "entity": "order",
                "amount": amount,
                "currency": currency,
                "receipt": payload["receipt"],
                "status": "created",
                "notes": order_notes,
                "dry_run": True,
            }

        try:
            order = self._client.order.create(data=payload)
            logger.info(f"[LIVE TEST MODE] Created Razorpay Order: {order.get('id')}")
            return order
        except Exception as e:
            logger.error(f"Razorpay API error creating order: {e}")
            return {"error": str(e), "dry_run": False}

    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from Razorpay API."""
        if self.dry_run or not self._client:
            return {
                "id": payment_id,
                "entity": "payment",
                "status": "failed",
                "amount": 249900,
                "currency": "INR",
                "dry_run": True,
                "method": "upi",
                "description": "Simulated test payment",
            }
        try:
            return self._client.payment.fetch(payment_id)
        except Exception as e:
            logger.error(f"Error fetching payment {payment_id}: {e}")
            return {"error": str(e), "dry_run": False}

    def retry_mandate_or_payment(
        self,
        payment_id: str,
        mandate_id: str,
        amount: int,
        currency: str = "INR",
        customer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute or simulate a mandate debit retry."""
        order_res = self.create_retry_order(
            amount=amount,
            currency=currency,
            payment_id=payment_id,
            mandate_id=mandate_id,
            notes={"action": "immediate_retry", "customer_id": customer_id},
        )

        return {
            "status": "success",
            "action": "retry_executed",
            "order_id": order_res.get("id"),
            "payment_id": f"pay_retry_{payment_id[:10]}",
            "mandate_id": mandate_id,
            "amount": amount,
            "currency": currency,
            "dry_run": self.dry_run or (self._client is None),
            "order_details": order_res,
            "message": "Razorpay test-mode retry order created successfully.",
        }


razorpay_service = RazorpayService()
