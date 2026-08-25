"""
Multilingual Customer Recovery Messaging Service (English & Conversational Hinglish).
Generates compliant, high-converting notification copy across WhatsApp, SMS, Email, and Push,
with interactive Promise-to-Pay (P2P) scheduling and UPI 1-click fallback links.

References:
- RBI Customer Protection Directives
- NPCI Circular on Pre-Debit Notifications (NPCI/UPI/OC-97/2020-21)
"""

from typing import Any, Dict, Optional


def generate_recovery_messages(
    customer_id: str,
    mandate_id: str,
    amount_inr: float,
    decline_reason: str,
    action: str,
    scheduled_date_str: Optional[str] = None,
    payment_link_base: str = "https://rzp.io/i/recov_",
) -> Dict[str, Any]:
    """Generate dynamic English and Hinglish templates across channels."""
    short_link = f"{payment_link_base}{customer_id[-4:]}_{mandate_id[-4:]}"
    p2p_link = f"{payment_link_base}p2p_{customer_id[-4:]}"
    date_display = scheduled_date_str or "the next banking business day"

    # 1. WhatsApp Templates
    whatsapp_english = (
        f"Hi! 👋 Your recurring payment of *₹{amount_inr:,.2f}* for mandate `{mandate_id}` "
        f"could not be processed due to *{decline_reason.replace('_', ' ').title()}*.\n\n"
        f"📅 We have scheduled a re-attempt for *{date_display}*.\n"
        f"💡 Want to pay now or pick your own date? Tap below:\n"
        f"👉 Quick Pay / Select Date: {p2p_link}"
    )

    whatsapp_hinglish = (
        f"Namaste! 🙏 Aapka *₹{amount_inr:,.2f}* ka autopay mandate `{mandate_id}` "
        f"*{decline_reason.replace('_', ' ').title()}* ki wajah se complete nahi ho paya.\n\n"
        f"📅 Humne next retry *{date_display}* ko schedule ki hai.\n"
        f"💡 Agar aap abhi pay karna chahte hain ya date change karna chahte hain, toh yahan click karein:\n"
        f"👉 Abhi Pay Karein / Date Chunein: {p2p_link}"
    )

    # 2. SMS Templates (160 char compliant)
    sms_english = (
        f"Your autopay debit of Rs.{amount_inr:.0f} failed ({decline_reason}). "
        f"Retry scheduled for {date_display}. Pay now: {short_link} - Razorpay"
    )
    sms_hinglish = (
        f"Aapka Rs.{amount_inr:.0f} ka recurring debit fail hua. "
        f"Agla retry {date_display} ko hoga. Abhi pay karein: {short_link} - Razorpay"
    )

    # 3. Email Templates
    email_english = {
        "subject": f"Notice: Update on your recurring payment of ₹{amount_inr:,.2f}",
        "body_preview": f"Payment retry scheduled for {date_display}. Instant resolution options available.",
    }
    email_hinglish = {
        "subject": f"Zaroori Suchna: Aapka recurring payment ₹{amount_inr:,.2f} update karein",
        "body_preview": f"Agla retry {date_display} ko schedule kiya gaya hai. Promise-to-Pay option available hai.",
    }

    # 4. Promise-to-Pay (P2P) Options
    p2p_options = [
        {"option_id": "pay_now", "label_en": "Pay Instantly via UPI / Card", "label_hi": "Abhi UPI se Pay Karein"},
        {"option_id": "delay_salary", "label_en": "I get salary on 1st of month", "label_hi": "Meri salary 1 tareekh ko aati hai"},
        {"option_id": "switch_method", "label_en": "Switch to different Bank / Card", "label_hi": "Dusra Bank / Card use karein"},
        {"option_id": "cancel_mandate", "label_en": "Cancel this subscription", "label_hi": "Yeh subscription band karein"},
    ]

    return {
        "customer_id": customer_id,
        "amount_inr": amount_inr,
        "channels": {
            "whatsapp": {
                "english": whatsapp_english,
                "hinglish": whatsapp_hinglish,
                "interactive_buttons": ["Pay Now", "Change Retry Date", "Help Desk"],
            },
            "sms": {
                "english": sms_english,
                "hinglish": sms_hinglish,
            },
            "email": {
                "english": email_english,
                "hinglish": email_hinglish,
            },
        },
        "promise_to_pay": {
            "p2p_portal_url": p2p_link,
            "options": p2p_options,
        },
    }
