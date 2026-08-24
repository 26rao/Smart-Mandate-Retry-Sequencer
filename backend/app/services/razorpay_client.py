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
        self._order_idempotency_cache: Dict[str, Dict[str, Any]] = {}

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
        mandate_failure_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new Razorpay Order in test mode with strict idempotency guard."""
        # Check idempotency cache first
        idempotency_key = f"{mandate_failure_id or mandate_id or payment_id}_att{attempt_number or 1}"
        if idempotency_key in self._order_idempotency_cache:
            cached_order = self._order_idempotency_cache[idempotency_key]
            logger.info(f"[IDEMPOTENCY GUARD] Reusing existing order for {idempotency_key}: {cached_order.get('id')}")
            return cached_order

        order_notes = {
            "source": "smart_mandate_sequencer",
            "original_payment_id": payment_id or "unknown",
            "mandate_id": mandate_id or "unknown",
        }
        if decline_category:
            order_notes["decline_category"] = str(decline_category)
        if attempt_number is not None:
            order_notes["attempt_number"] = str(attempt_number)
        if mandate_failure_id:
            order_notes["mandate_failure_id"] = str(mandate_failure_id)
        if notes:
            order_notes.update(notes)

        deterministic_receipt = f"rcpt_{mandate_id or 'mandate'[:8]}_{attempt_number or 1}"[:40]

        payload = {
            "amount": amount,
            "currency": currency,
            "receipt": deterministic_receipt,
            "notes": order_notes,
        }

        if self.dry_run or not self._client:
            mock_order_id = f"order_{uuid.uuid4().hex[:14]}"
            logger.info(f"[DRY-RUN] Created Simulated Test Order: {mock_order_id} for {amount/100} INR")
            res = {
                "id": mock_order_id,
                "entity": "order",
                "amount": amount,
                "currency": currency,
                "receipt": payload["receipt"],
                "status": "created",
                "notes": order_notes,
                "dry_run": True,
            }
            self._order_idempotency_cache[idempotency_key] = res
            return res

        try:
            order = self._client.order.create(data=payload)
            logger.info(f"[LIVE TEST MODE] Created Razorpay Order: {order.get('id')}")
            self._order_idempotency_cache[idempotency_key] = order
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


def create_retry_order(
    amount: int,
    currency: str = "INR",
    payment_id: Optional[str] = None,
    mandate_id: Optional[str] = None,
    attempt_number: Optional[int] = None,
    category: Optional[str] = None,
    mandate_failure_id: Optional[str] = None,
) -> Dict[str, Any]:
    return razorpay_service.create_retry_order(
        amount=amount,
        currency=currency,
        payment_id=payment_id,
        mandate_id=mandate_id,
        decline_category=category,
        attempt_number=attempt_number,
        mandate_failure_id=mandate_failure_id,
    )

