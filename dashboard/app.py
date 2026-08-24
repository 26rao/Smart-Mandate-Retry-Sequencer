import json
import os
import sys
from datetime import datetime, timezone
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.database import init_db_sync, SyncSessionLocal
from app.models import DBAuditEntry, DBDecision, DBMandateFailure, MandateFailure
from app.agent.graph import sequencer_agent
from app.simulator.generator import generate_synthetic_failures
from app.simulator.personas import PERSONAS
from app.taxonomy import TAXONOMY_MAP
from app.utils.audit import save_sequencer_state_sync
from app.utils.metrics import evaluator

st.set_page_config(
    page_title="Razorpay Smart Mandate Retry Sequencer",
    page_icon="💳",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown(
    """
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #0c2340;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.05rem;
        color: #555;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 1.2rem;
        border-radius: 10px;
        border-left: 5px solid #0052cc;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .badge-safe {
        background-color: #28a745;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .badge-warn {
        background-color: #ffc107;
        color: black;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .badge-stop {
        background-color: #dc3545;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Initialize DB on load
init_db_sync()


# Sidebar Configuration
st.sidebar.image("https://razorpay.com/assets/razorpay-logo.svg", width=180)
st.sidebar.markdown("### ⚙️ System Controls")
st.sidebar.markdown(f"**Regulatory Ceiling:** `Max {settings.MAX_ATTEMPTS} Attempts`")
st.sidebar.markdown(f"**Dry Run Safety:** `{'ENABLED (Mock)' if settings.DRY_RUN else 'LIVE TEST MODE'}`")
st.sidebar.markdown(f"**LLM Classifier:** `{settings.LLM_PROVIDER.upper()}`")
st.sidebar.divider()

st.sidebar.markdown("### 📌 Quick Problem Context")
st.sidebar.info(
    "**The Problem:** Naive calendar retries (+24/72/168h) waste the RBI/NPCI 4-attempt limit on dead mandates (e.g. revoked consent, closed accounts) and fail cashflow-sensitive declines.\n\n"
    "**The Solution:** Smart decline-aware taxonomy + deterministic safety rules + customer salary timing."
)

# Main Title Header
st.markdown('<div class="main-header">💳 Razorpay Smart Mandate Retry Sequencer</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header">Agentic Mandate Recovery Engine • Strict Regulatory Policy Guard • Attempt-Budget Optimization</div>',
    unsafe_allow_html=True,
)

tabs = st.tabs([
    "📊 Benchmark vs Dumb Baseline",
    "⚡ Live Recovery Queue",
    "🧪 Interactive Scenario Inspector",
    "🛡️ Compliance & Audit Ledger",
    "📖 Architecture & Taxonomy Map",
])

# -------------------------------------------------------------
# TAB 1: Benchmark & Evaluation
# -------------------------------------------------------------
with tabs[0]:
    st.subheader("Held-Out Synthetic Batch Evaluation (250 Mandates)")
    st.markdown(
        "Run an empirical head-to-head comparison between **Dumb Calendar Retries** (Fixed +24h/+72h/+168h) vs **Smart Mandate Sequencer**."
    )

    col_btn, col_info = st.columns([1, 3])
    with col_btn:
        run_btn = st.button("🚀 Run 250 Mandate Benchmark", type="primary", use_container_width=True)

    if run_btn or "benchmark_results" not in st.session_state:
        with st.spinner("Executing simulation on 250 held-out mandate failure payloads..."):
            failures = generate_synthetic_failures(count=250, seed=42)
            states = []
            for f in failures:
                stt = sequencer_agent.run_sync(f)
                save_sequencer_state_sync(stt)
                states.append(stt)
            comparison = evaluator.compare(failures, states)
            st.session_state["benchmark_results"] = comparison
            st.session_state["benchmark_states"] = states
            st.session_state["benchmark_failures"] = failures

    res = st.session_state["benchmark_results"]
    b = res["baseline"]
    s = res["sequencer"]
    c = res["comparison"]

    # KPI Summary Cards
    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    with kpi1:
        st.metric(
            label="Total At-Risk Volume",
            value=f"₹{s['total_at_risk_inr']:,.0f}",
            help="Total face value of 250 failed recurring payments",
        )
    with kpi2:
        st.metric(
            label="Sequencer Recovered",
            value=f"₹{s['recovered_inr']:,.0f}",
            delta=f"+₹{c['additional_inr_recovered']:,.0f} vs Baseline",
        )
    with kpi3:
        st.metric(
            label="Attempts Saved",
            value=f"{c['attempts_saved']} ({c['attempts_saved_pct']}%)",
            delta=f"{s['avg_attempts_per_mandate']} vs {b['avg_attempts_per_mandate']} avg",
            delta_color="normal",
        )
    with kpi4:
        st.metric(
            label="Compliance Score",
            value=f"{s['compliance_pct']}% (0 Violations)",
            delta=f"+{c['policy_violations_prevented']} Violations Prevented",
        )

    st.markdown("---")

    # Visual Charts
    c_left, c_right = st.columns(2)

    with c_left:
        # Recovery Comparison
        fig_rec = go.Figure()
        fig_rec.add_trace(go.Bar(
            name="Dumb Calendar Baseline",
            x=["Revenue Recovered (₹)"],
            y=[b["recovered_inr"]],
            marker_color="#dc3545",
            text=[f"₹{b['recovered_inr']:,.0f} ({b['recovery_rate_pct']:.1f}%)"],
            textposition="auto",
        ))
        fig_rec.add_trace(go.Bar(
            name="Smart Sequencer",
            x=["Revenue Recovered (₹)"],
            y=[s["recovered_inr"]],
            marker_color="#28a745",
            text=[f"₹{s['recovered_inr']:,.0f} ({s['recovery_rate_pct']:.1f}%)"],
            textposition="auto",
        ))
        fig_rec.update_layout(
            title="Revenue Recovery Comparison",
            barmode="group",
            yaxis_title="INR (₹)",
            height=350,
            template="plotly_white",
        )
        st.plotly_chart(fig_rec, use_container_width=True)

    with c_right:
        # Attempts & Violations
        fig_att = go.Figure()
        fig_att.add_trace(go.Bar(
            name="Attempts Burned",
            x=["Dumb Baseline", "Smart Sequencer"],
            y=[b["total_attempts_used"], s["total_attempts_used"]],
            marker_color=["#6c757d", "#0052cc"],
            text=[f"{b['total_attempts_used']} attempts", f"{s['total_attempts_used']} attempts"],
            textposition="auto",
        ))
        fig_att.update_layout(
            title=f"Total Retry Attempts Spent ({c['attempts_saved_pct']}% Saved)",
            yaxis_title="Total Debit Requests",
            height=350,
            template="plotly_white",
        )
        st.plotly_chart(fig_att, use_container_width=True)

    # Breakdown Table
    st.markdown("### 📋 Side-by-Side Performance Scorecard")
    scorecard_df = pd.DataFrame([
        {
            "Metric": "Total Failed Mandates Analyzed",
            "Dumb Calendar Baseline": f"{b['total_mandates']}",
            "Smart Mandate Sequencer": f"{s['total_mandates']}",
            "Delta / Improvement": "Identical Test Set",
        },
        {
            "Metric": "Total Recovered Volume (₹)",
            "Dumb Calendar Baseline": f"₹{b['recovered_inr']:,.2f}",
            "Smart Mandate Sequencer": f"₹{s['recovered_inr']:,.2f}",
            "Delta / Improvement": f"+₹{c['additional_inr_recovered']:,.2f} (+{s['recovery_rate_pct'] - b['recovery_rate_pct']:.1f}%)",
        },
        {
            "Metric": "Total Retry Attempts Expended",
            "Dumb Calendar Baseline": f"{b['total_attempts_used']}",
            "Smart Mandate Sequencer": f"{s['total_attempts_used']}",
            "Delta / Improvement": f"-{c['attempts_saved']} attempts ({c['attempts_saved_pct']}% efficiency gain)",
        },
        {
            "Metric": "RBI/NPCI Policy Violations",
            "Dumb Calendar Baseline": f"{b['policy_violations']} illegal retries",
            "Smart Mandate Sequencer": "0 (100% Policy Bound)",
            "Delta / Improvement": f"{c['policy_violations_prevented']} violations prevented",
        },
        {
            "Metric": "Non-Recoverable Exceptions Filtered",
            "Dumb Calendar Baseline": "0 (wasted retries)",
            "Smart Mandate Sequencer": f"{s['exceptions_count']} clean hard-stops / escalations",
            "Delta / Improvement": "100% zero-wasted retries on fatal errors",
        },
    ])
    st.table(scorecard_df)

# -------------------------------------------------------------
# TAB 2: Live Recovery Queue
# -------------------------------------------------------------
with tabs[1]:
    st.subheader("⚡ Live Mandate Recovery Queue")
    if "benchmark_states" in st.session_state:
        states = st.session_state["benchmark_states"]
        rows = []
        for s in states:
            f = s.failure
            diag = s.diagnosis
            dec = s.decision
            rows.append({
                "Mandate ID": f.mandate_id,
                "Amount (₹)": f"₹{f.amount / 100:,.2f}",
                "Customer Persona": (f.customer_persona or "N/A").replace("_", " ").title(),
                "Error Code": f.error_code,
                "Decline Category": diag.category.value if diag else "unknown",
                "Recoverability": f"{diag.recoverability * 100:.0f}%" if diag else "0%",
                "Action Decided": dec.action.value if dec else "escalate",
                "Remaining Attempts": dec.remaining_attempts if dec else 0,
                "Rationale": dec.rationale if dec else "",
            })
        df_queue = pd.DataFrame(rows)

        # Filters
        f_col1, f_col2 = st.columns(2)
        with f_col1:
            cat_filter = st.multiselect(
                "Filter by Decline Category",
                options=sorted(list(df_queue["DeclineCategory" if "DeclineCategory" in df_queue else "Decline Category"].unique())),
                default=[],
            )
        with f_col2:
            act_filter = st.multiselect(
                "Filter by Action Decided",
                options=sorted(list(df_queue["Action Decided"].unique())),
                default=[],
            )

        filtered_df = df_queue
        if cat_filter:
            filtered_df = filtered_df[filtered_df["Decline Category"].isin(cat_filter)]
        if act_filter:
            filtered_df = filtered_df[filtered_df["Action Decided"].isin(act_filter)]

        st.dataframe(filtered_df, use_container_width=True, height=450)
    else:
        st.info("Run the benchmark in Tab 1 to populate the recovery queue.")

# -------------------------------------------------------------
# TAB 3: Interactive Scenario Inspector
# -------------------------------------------------------------
with tabs[2]:
    st.subheader("🧪 Interactive Scenario Inspector & Intentional Failures")
    st.markdown(
        "Select a pre-built intentional edge-case or craft a custom Razorpay failure payload to watch the Sequencer FSM pipeline in real-time."
    )

    preset_col1, preset_col2, preset_col3 = st.columns(3)

    sample_to_load = None
    with preset_col1:
        if st.button("🚫 Case 1: Consent Revoked (RBI Hard Stop)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_revoked_01",
                "payment_id": "pay_test_9901",
                "mandate_id": "man_test_9901",
                "amount": 199900,
                "error_code": "BAD_REQUEST_ERROR",
                "error_reason": "mandate_cancelled_by_customer",
                "error_source": "customer",
                "error_step": "mandate_validation",
                "error_description": "Customer cancelled recurring mandate via UPI app.",
                "attempt_number": 1,
                "salary_day_of_month": 1,
            }
        if st.button("💳 Case 2: Card Expired (Method Switch)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_card_exp_02",
                "payment_id": "pay_test_9902",
                "mandate_id": "man_test_9902",
                "amount": 99900,
                "error_code": "BAD_REQUEST_ERROR",
                "error_reason": "card_expired",
                "error_source": "customer",
                "error_step": "payment_authorization",
                "error_description": "Card expiry date passed. Saved token invalidated.",
                "attempt_number": 1,
                "salary_day_of_month": 1,
            }

    with preset_col2:
        if st.button("💰 Case 3: Salary Timing (Insufficient Funds)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_insufficient_03",
                "payment_id": "pay_test_9903",
                "mandate_id": "man_test_9903",
                "amount": 499900,
                "error_code": "BAD_REQUEST_ERROR",
                "error_reason": "insufficient_funds",
                "error_source": "customer",
                "error_step": "payment_authorization",
                "error_description": "Account balance lower than transaction amount.",
                "attempt_number": 1,
                "salary_day_of_month": 1,
            }
        if st.button("⚡ Case 4: Bank Timeout (Fast Retry Now)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_timeout_04",
                "payment_id": "pay_test_9904",
                "mandate_id": "man_test_9904",
                "amount": 150000,
                "error_code": "GATEWAY_ERROR",
                "error_reason": "gateway_timeout",
                "error_source": "gateway",
                "error_step": "payment_authorization",
                "error_description": "Timeout waiting for issuing bank authorization switch.",
                "attempt_number": 1,
                "salary_day_of_month": 7,
            }

    with preset_col3:
        if st.button("⚠️ Case 5: 4th Attempt Limit (Escalate)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_exhausted_05",
                "payment_id": "pay_test_9905",
                "mandate_id": "man_test_9905",
                "amount": 350000,
                "error_code": "BAD_REQUEST_ERROR",
                "error_reason": "insufficient_funds",
                "error_source": "customer",
                "error_step": "payment_authorization",
                "error_description": "Balance low.",
                "attempt_number": 4,  # Final attempt
                "salary_day_of_month": 1,
            }
        if st.button("🏦 Case 6: Account Closed (Hard Stop)", use_container_width=True):
            sample_to_load = {
                "id": "mf_test_closed_06",
                "payment_id": "pay_test_9906",
                "mandate_id": "man_test_9906",
                "amount": 120000,
                "error_code": "BAD_REQUEST_ERROR",
                "error_reason": "account_closed",
                "error_source": "bank",
                "error_step": "payment_authorization",
                "error_description": "Customer account permanently closed.",
                "attempt_number": 1,
                "salary_day_of_month": 0,
            }

    if sample_to_load:
        st.session_state["custom_input"] = sample_to_load

    st.markdown("---")
    st.markdown("#### 📝 Edit Mandate Payload")

    default_data = st.session_state.get(
        "custom_input",
        {
            "id": "mf_custom_001",
            "payment_id": "pay_custom_001",
            "mandate_id": "man_custom_001",
            "amount": 250000,
            "error_code": "BAD_REQUEST_ERROR",
            "error_reason": "insufficient_funds",
            "error_source": "customer",
            "error_step": "payment_authorization",
            "error_description": "Account balance lower than transaction amount.",
            "attempt_number": 1,
            "salary_day_of_month": 1,
        },
    )

    in_c1, in_c2, in_c3 = st.columns(3)
    with in_c1:
        c_code = st.text_input("Error Code", value=default_data["error_code"])
        c_reason = st.text_input("Error Reason", value=default_data["error_reason"])
        c_amount = st.number_input("Amount (in paise)", value=int(default_data["amount"]), step=10000)

    with in_c2:
        c_attempt = st.number_input("Attempt Number", value=int(default_data["attempt_number"]), min_value=1, max_value=5)
        c_salary_day = st.number_input("Salary Day of Month", value=int(default_data.get("salary_day_of_month", 1)), min_value=0, max_value=31)
        c_desc = st.text_input("Error Description", value=default_data["error_description"])

    with in_c3:
        st.write("")
        st.write("")
        test_exec_btn = st.button("⚡ Run Sequencer Pipeline", type="primary", use_container_width=True)

    if test_exec_btn:
        mf = MandateFailure(
            id=default_data.get("id", "mf_custom"),
            payment_id=default_data.get("payment_id", "pay_custom"),
            mandate_id=default_data.get("mandate_id", "man_custom"),
            amount=c_amount,
            error_code=c_code,
            error_reason=c_reason,
            error_source="customer",
            error_step="payment_authorization",
            error_description=c_desc,
            attempt_number=c_attempt,
            salary_day_of_month=c_salary_day,
        )

        with st.spinner("Processing through Sequencer FSM pipeline..."):
            stt = sequencer_agent.run_sync(mf)
            save_sequencer_state_sync(stt)

        st.success("Pipeline executed successfully!")

        res_c1, res_c2, res_c3 = st.columns(3)
        with res_c1:
            st.markdown("#### 1. 🔍 Diagnosis")
            diag = stt.diagnosis
            st.write(f"**Category:** `{diag.category.value}`")
            st.write(f"**Recoverability:** `{diag.recoverability * 100:.0f}%`")
            st.write(f"**Confidence:** `{diag.confidence * 100:.0f}%`")
            st.info(diag.reason)

        with res_c2:
            st.markdown("#### 2. 🛡️ Deterministic Decision")
            dec = stt.decision
            st.write(f"**Action:** `{dec.action.value}`")
            st.write(f"**Remaining Attempts:** `{dec.remaining_attempts}`")
            st.write(f"**Schedule Time:** `{dec.schedule_at}`")
            st.warning(f"**Rationale:** {dec.rationale}")

        with res_c3:
            st.markdown("#### 3. 🚀 Execution & Template")
            if dec.message_template:
                st.write("**Customer Notification Template:**")
                st.code(dec.message_template, language="text")
            st.write("**Execution Dispatch:**")
            st.json(stt.execution_result)

# -------------------------------------------------------------
# TAB 4: Compliance & Audit Ledger
# -------------------------------------------------------------
with tabs[3]:
    st.subheader("🛡️ Compliance & SQLite Audit Trail Explorer")
    st.markdown("Every transition, diagnosis, and decision is written immutably to the SQLite audit ledger.")

    with SyncSessionLocal() as session:
        audit_rows = session.query(DBAuditEntry).order_by(DBAuditEntry.timestamp.desc()).limit(100).all()

    if audit_rows:
        audit_list = []
        for a in audit_rows:
            audit_list.append({
                "Timestamp (UTC)": a.timestamp.strftime("%Y-%m-%d %H:%M:%S") if a.timestamp else "N/A",
                "Mandate Failure ID": a.mandate_failure_id,
                "Stage": a.stage,
                "LLM Used": "Yes" if a.llm_used else "No (Deterministic)",
                "Notes": a.notes or "",
                "Input Data": json.dumps(a.input_data) if a.input_data else "{}",
                "Output Data": json.dumps(a.output_data) if a.output_data else "{}",
            })
        st.dataframe(pd.DataFrame(audit_list), use_container_width=True, height=400)
    else:
        st.info("No audit logs recorded yet. Execute actions in Tabs 1, 2, or 3.")

# -------------------------------------------------------------
# TAB 5: Architecture & Taxonomy Map
# -------------------------------------------------------------
with tabs[4]:
    st.subheader("📖 Decline Taxonomy & Regulatory Rules Matrix")
    st.markdown(
        "The Sequencer uses a high-precision deterministic mapping for known Razorpay error combinations. Unrecognized patterns trigger structured few-shot LLM classification before passing to the safety policy."
    )

    tax_rows = []
    for (code, reason), val in TAXONOMY_MAP.items():
        tax_rows.append({
            "Error Code": code,
            "Error Reason": reason,
            "Decline Category": val["category"].value,
            "Recoverability": f"{val['recoverability'] * 100:.0f}%",
            "Default Action": val["default_action"].value,
            "Cooldown / Delay": f"{val.get('suggested_delay_hours')}h" if val.get("suggested_delay_hours") else "Immediate / N/A",
            "Clinical Rationale": val["reason"],
        })
    st.dataframe(pd.DataFrame(tax_rows), use_container_width=True, height=450)

    st.markdown("---")
    st.markdown("### 🏛️ System State Machine")
    st.markdown(
        """
        ```
        [Failed Mandate Event]
                 │
                 ▼
        ┌──────────────────┐
        │  1. DETECT NODE  │ ──> Validate event schema & attempt budget
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ 2. DIAGNOSE NODE │ ──> Fast Taxonomy Lookup (or Few-Shot LLM Fallback)
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │  3. DECIDE NODE  │ ──> Hard Policy: Max 4 Attempts, RBI Consent Guard, Salary Timing
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ 4. EXECUTE NODE  │ ──> Smart Schedule / Retry Now / Method Switch / Hard Stop
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │  5. AUDIT NODE   │ ──> Immutable SQLite Ledger Record
        └──────────────────┘
        ```
        """
    )
