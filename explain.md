# 💳 Razorpay Smart Mandate Retry Sequencer — Architecture & System Explanation

> **Comprehensive Technical Guide to the Architecture, Implemented Subsystems, Regulatory Gates, and Economic Models.**

---

## 📌 1. Executive Overview: What is this Project?

In the Indian digital payments ecosystem, recurring subscriptions (UPI Autopay, Card e-Mandates, and e-NACH) face **unnecessary churn, merchant revenue loss, and severe regulatory non-compliance** due to **naive calendar retries** (+24h, +72h, +168h).

### The Critical Problems in Recurring Payments:
1. **Regulatory Risk & Attempt Caps**:
   - **NPCI UPI Autopay Circular OC 122/2021-22**: Strictly restricts UPI Autopay to a **maximum of 4 total attempts** (1 original presentation + 3 retries).
   - **RBI Master Direction on Recurring Payments**: Limits Card e-Mandates to a maximum of **3 attempts**.
   - Retrying revoked mandates, closed bank accounts, or exhausted attempt budgets exposes merchants to regulatory penalties and terminal de-registration.
2. **Statutory 24-Hour Pre-Debit Notice Window**:
   - RBI Circular *DPSS.CO.PD No.447/02.14.003/2019-20 Sec 3(b)* mandates that customers must receive pre-debit notifications at least 24 hours prior to recurring execution. Naive retries frequently schedule debits before this statutory buffer expires.
3. **Negative Expected Value (EV) Burn**:
   - Retrying micro-transactions with low recovery probability burns gateway attempt fees (₹2.50 per hit) and bank surcharges, destroying unit economics.
4. **Liquidity Timing Mismatch**:
   - Retrying a salaried subscriber on the 28th of the month has a ~14% success rate, whereas aligning with their salary credit on the 1st of the month yields **>80% recovery**.

### The Solution:
The **Razorpay Smart Mandate Retry Sequencer** is an agentic, regulatory-first recovery engine that converts recurring declines into recovered revenue by combining:
- **Deterministic 50+ Decline Taxonomy** + **Dynamic Groq `gpt-oss-120b` Classification** with graceful fallback.
- **Strict Deterministic Policy Gates** enforcing NPCI/RBI attempt budgets and statutory 24-hour notification windows.
- **Expected-Value (EV) Mathematical Optimization** protecting merchant margins.
- **Independent Zero-Trust Compliance Asserter** auditing records from the outside.
- **Cryptographic SHA-256 Merkle Audit Ledger** ensuring tamper-evident operational compliance.

---

## 🏛️ 2. Transparent 3-Tier Infrastructure Architecture

To maintain high engineering rigor, the codebase explicitly delineates between production-ready live logic, live but demo-scoped implementations, and synthetic evaluation benchmarks:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LIVE LAYER (Production Ready)                                            │
│  ├── Decline Taxonomy (50+ Error Signatures)                                │
│  ├── Groq gpt-oss-120b LLM Classifier with Graceful Fallback               │
│  ├── Deterministic NPCI / RBI Policy Guards (4 UPI / 3 Card Caps)           │
│  ├── Statutory 24-Hour Pre-Debit Notice Clamping Engine                     │
│  ├── Independent Zero-Trust Compliance Verifier (Outside Auditor)           │
│  └── Inbound Razorpay Webhook HMAC-SHA256 Signature Verification            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LIVE, DEMO-SCOPED LAYER (In-Memory / Local Stand-ins)                    │
│  ├── Idempotency Lock: In-process cache [Prod: Redis Redlock Distributed]   │
│  ├── Audit Ledger: Local SQLite SHA-256 Merkle [Prod: Append-Only AWS QLDB] │
│  └── Order Dispatch: Official Razorpay Test-Mode SDK (client.order.create)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. SYNTHETIC BENCHMARK LAYER (Reproducible Science)                         │
│  ├── 250-Mandate Held-Out Empirical Benchmark Batch                         │
│  └── Multi-Seed Sensitivity Analysis (Seeds 42, 101, 777; Variance < 2.8%)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 3. Core Implemented Subsystems & Flow

```
                      Inbound Failed Mandate Payload / Webhook
                                      │
                                      ▼
                        [1. INGESTION & HMAC GUARD]
                  Verify X-Razorpay-Signature (HMAC-SHA256)
                                      │
                                      ▼
                             [2. DIAGNOSIS STAGE]
             Is signature in 50+ Taxonomy?
             ├── YES ──► Exact Deterministic Prior
             └── NO  ──► Groq gpt-oss-120b Reasoning
                         (Fallback: Safe Soft-Notify if offline)
                                      │
                                      ▼
                              [3. DECISION STAGE]
             ├── Apply NPCI UPI Cap (<=4) vs RBI Card Cap (<=3)
             ├── Clamp Schedule Time: max(schedule_at, notice_at + 24h)
             ├── Check Non-Peak Window (02:00–06:00 IST / 03:30 UTC)
             ├── Calculate Expected Value: EV = (P_recover * Amount) - ₹2.50
             └── Generate Plain-English Auditor Explainability Card
                                      │
                                      ▼
                             [4. EXECUTION STAGE]
             ├── Idempotent Test-Mode Razorpay Order Dispatch
             └── Multilingual Customer Recovery Copy (Hinglish/English)
                                      │
                                      ▼
                          [5. CRYPTOGRAPHIC AUDIT]
             Append Block: Hash(Hash_{n-1} : Payload) in SQLite
                                      │
                                      ▼
                       [6. ZERO-TRUST INDEPENDENT AUDIT]
             External brute-force assertion of all regulatory rules
```

---

## 🔍 4. Detailed Breakdown of Key Implemented Features

### A. Deterministic Policy Layer (`app/policy.py`)
- **Framework-Specific Attempt Budgeting**:
  $$\text{Attempts Left} = \text{Max Attempts}(\text{Method}) - \text{Attempt Number}$$
  * UPI Autopay: Max 4 attempts.
  * Saved Card / e-Mandate: Max 3 attempts.
  * e-NACH: Max 3 attempts.
- **Statutory 24-Hour Notice Floor**:
  $$\text{schedule\_at} = \max(\text{schedule\_at}, \text{notice\_sent\_at} + 24\text{ hours})$$
  Ensures no transaction violates RBI notice timing rules, even if an AI or algorithm recommends immediate cooldown.
- **Economic Value (EV) Guard**:
  $$\text{EV} = (P_{\text{recoverability}} \times \text{Amount}_{\text{INR}}) - \text{Attempt Cost}_{\text{INR}}$$
  If $\text{EV} \le 0$, the system automatically halts execution to prevent fee loss on hopeless micro-transactions.

### B. Independent Zero-Trust Compliance Verifier (`app/utils/verifier.py`)
- Completely decoupled outside auditor that queries raw database tables without trusting internal FSM state.
- **5 Brute-Force Assertions**:
  1. **NPCI UPI Attempt Cap**: Asserts $\text{Attempts} \le 4$ per mandate.
  2. **RBI Card Attempt Cap**: Asserts $\text{Attempts} \le 3$ per mandate.
  3. **Statutory Notice Delta**: Asserts $(\text{schedule\_at} - \text{notice\_sent\_at}) \ge 24\text{ hours}$.
  4. **Terminal Revocation Lock**: Asserts 0 subsequent retries occurred on revoked or closed accounts.
  5. **Merkle Chain Integrity**: Asserts $H_n = \text{SHA256}(H_{n-1} : \text{Row Payload})$.

### C. Plain-English Decision Explainability Panel
- Every retry decision surfaces a structured explainability card in the Live Sequencer UI:
  - **Regulatory Clause Cited**: e.g., *RBI Circular DPSS.CO.PD No.447/02.14.003/2019-20 Sec 3(b)*.
  - **Plugged-in EV Equation**: e.g., $\text{EV} = (88\% \times ₹3,499.00) - ₹2.50 = ₹3,076.62\ (+88\%\ \text{ROI})$.
  - **Strategy Rationale**: Plain-English explanation of why alternative paths were rejected.

### D. Multilingual Customer Messaging & Promise-to-Pay (P2P)
- Generates high-converting, compliant messaging in **Formal English** and **Conversational Hinglish** across WhatsApp Business API, 160-character SMS, and Email.
- **Clean Enterprise Formatting**: Free of consumer emojis for regulatory compliance.
- Interactive Promise-to-Pay (P2P) quick actions: *Pay Instantly*, *Delay to Salary Day (1st)*, *Switch Card/Bank*, and *Cancel Mandate*.

### E. Human-in-the-Loop Operations Queue (`/api/v1/ops/resolve`)
- Dedicated workflow for customer support and fraud analysts to resolve stopped/escalated mandates.
- Every manual override commits a signed SHA-256 block into the immutable audit trail.

---

## 📊 5. Empirical Benchmark & Sensitivity Results

### Head-to-Head Evaluation (Held-Out N=250 Dataset)
| Metric | Naive Calendar Baseline | Smart Sequencer (Ours) | Delta / Improvement |
| :--- | :---: | :---: | :---: |
| **Total At-Risk Volume** | ₹7,61,000 | ₹7,61,000 | Baseline |
| **Recovered Revenue** | ₹4,27,120 (56.1%) | **₹5,77,392 (75.9%)** | **+₹1,50,272 (+19.8% lift)** |
| **Attempts Expended** | 901 attempts | **185 attempts** | **-716 attempts (79.5% saved)** |
| **Avg Attempts / Mandate** | 3.60 | **0.74** | **4.86x attempt efficiency** |
| **Regulatory Violations** | 158 illegal debits | **0 (100% Policy Bound)** | **158 violations prevented** |
| **Negative EV Retries Halted** | 0 (blindly retried) | **12 halted** | **100% unit economics protected** |

### Multi-Seed Sensitivity Sweep (Seeds 42, 101, 777)
| Seed | Baseline Recovery | Smart Sequencer | Net Lift | Attempts Saved | Violations Prevented |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Seed 42** | 56.1% | 75.9% | **+19.8%** | 79.5% | 158 |
| **Seed 101** | 54.8% | 74.2% | **+19.4%** | 78.2% | 162 |
| **Seed 777** | 57.2% | 77.1% | **+19.9%** | 80.1% | 154 |
| **Median** | **56.1%** | **75.9%** | **+19.8%** | **79.5%** | **158** |

*Variance across seeds is $<2.8\%$, proving mathematical stability across held-out distributions.*

---

## 🧪 6. Test Suite & Verification

The project includes **21 automated unit and E2E tests** (`pytest backend/tests -v`):
- `tests/test_policy.py`: 5 tests validating consent withdrawal hard stops, attempt budget limits, salary alignment, RBI e-mandate scoping, and 24h statutory clamping.
- `tests/test_taxonomy.py`: 5 tests validating error categorization, confidence scores, and recoverability ceilings.
- `tests/test_sequencer.py`: 3 E2E tests validating graph state transitions, idempotency, and order generation.
- `tests/test_verifier.py`: 2 tests validating the independent zero-trust auditor and HMAC-SHA256 webhook signatures.
- `tests/test_oracle_and_adversarial.py`: 6 tests validating theoretical oracle upper bounds, counterfactual generation, and bank holiday adjustments.

---

## 📁 7. File Map & Key Locations

```
├── backend/
│   ├── app/
│   │   ├── agent/             # State machine graph nodes & coordinator
│   │   ├── services/          # Groq LLM, Razorpay client, Webhook verifier, Messaging
│   │   ├── simulator/         # Synthetic batch generator & persona distributions
│   │   ├── utils/             # Independent verifier, audit ledger, metrics evaluator
│   │   ├── config.py          # Environment settings & attempt caps
│   │   ├── database.py        # SQLite schema & session management
│   │   ├── main.py            # FastAPI endpoints & CORS configuration
│   │   ├── models.py          # Pydantic schemas & SQLAlchemy ORM models
│   │   ├── policy.py          # Deterministic compliance rules & EV calculations
│   │   └── taxonomy.py        # 50+ Razorpay error signature lookup table
│   ├── tests/                 # 21 Pytest test suite files
│   └── requirements.txt       # Backend dependencies
├── frontend/
│   ├── src/app/
│   │   ├── components/        # Modals (RegulatoryMatrix, MessagingPreview, Inspectors)
│   │   ├── layout.tsx         # Next.js root layout
│   │   ├── page.tsx           # Interactive 4-tab sequencer studio
│   │   └── globals.css        # Tailwind styling & dark mode tokens
│   └── src/lib/api.ts         # TypeScript API client & interface definitions
├── .github/workflows/ci.yml   # GitHub Actions CI pipeline configuration
├── explain.md                 # Complete project technical documentation
└── README.md                  # Project overview & pitch deck reference
```
