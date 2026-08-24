from typing import Dict, Any, List
from pydantic import BaseModel


class CustomerPersona(BaseModel):
    name: str
    salary_day_of_month: int
    typical_amount_range: tuple[int, int]  # in paise
    description: str
    risk_level: str  # low | medium | high
    preferred_payment_method: str  # upi_autopay | emandate_netbanking | card_recurring


PERSONAS: Dict[str, CustomerPersona] = {
    "salaried_corporate": CustomerPersona(
        name="Salaried Corporate Professional",
        salary_day_of_month=1,
        typical_amount_range=(99900, 499900),  # Rs 999 - Rs 4,999
        description="Steady monthly salary on the 1st. Declines near month-end (25th-30th) are almost always temporary insufficient funds that recover on 1st/2nd.",
        risk_level="low",
        preferred_payment_method="upi_autopay",
    ),
    "mid_month_salaried": CustomerPersona(
        name="Mid-Month Salaried Executive",
        salary_day_of_month=7,
        typical_amount_range=(49900, 249900),  # Rs 499 - Rs 2,499
        description="Salary credited on the 7th of the month. Highly responsive to gentle balance reminders.",
        risk_level="low",
        preferred_payment_method="emandate_netbanking",
    ),
    "gig_freelancer": CustomerPersona(
        name="Freelancer & Gig Worker",
        salary_day_of_month=15,
        typical_amount_range=(19900, 150000),  # Rs 199 - Rs 1,500
        description="Fluctuating cashflows. Needs method switch suggestions or flexible retry windows.",
        risk_level="medium",
        preferred_payment_method="upi_autopay",
    ),
    "hnw_subscriber": CustomerPersona(
        name="High Net-Worth Subscriber",
        salary_day_of_month=1,
        typical_amount_range=(500000, 2500000),  # Rs 5,000 - Rs 25,000
        description="Zero liquidity issues. Declines are almost exclusively bank timeouts or daily transaction limits.",
        risk_level="low",
        preferred_payment_method="card_recurring",
    ),
    "chronic_defaulter": CustomerPersona(
        name="High Risk / Chronic Defaulter",
        salary_day_of_month=0,
        typical_amount_range=(29900, 99900),  # Rs 299 - Rs 999
        description="Frequent non-payment, depleted accounts, or unlinked mandates. Hard stops after initial failure.",
        risk_level="high",
        preferred_payment_method="card_recurring",
    ),
    "attrited_churner": CustomerPersona(
        name="Attrited / Cancelled User",
        salary_day_of_month=0,
        typical_amount_range=(49900, 199900),  # Rs 499 - Rs 1,999
        description="User actively cancelled mandate via bank app or closed account. Fatal 0% recoverability.",
        risk_level="high",
        preferred_payment_method="upi_autopay",
    ),
}
