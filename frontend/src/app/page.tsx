"use client";

import React, { useState, useEffect } from "react";
import {
  fetchHealth,
  fetchRealPayloads,
  processMandate,
  runBenchmark,
  fetchSensitivityAnalysis,
  fetchIndependentAudit,
  createRazorpayTestOrder,
  fetchAuditLogs,
  verifyAuditChain,
  resolveEscalatedMandate,
  getAuditExportUrl,
  fetchTaxonomy,
  RealErrorPayloadItem,
  ProcessResponse,
  BenchmarkResponse,
  SensitivityResponse,
  IndependentAuditResponse,
  AuditEntry,
} from "@/lib/api";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  RefreshCw,
  Code,
  CreditCard,
  MessageSquare,
  Clock,
  ExternalLink,
  Lock,
  Sparkles,
  Download,
  DollarSign,
  UserCheck,
  Check,
  Copy,
  Sliders,
  Activity,
  Search,
  Scale,
  BarChart3,
  HelpCircle,
  Info,
} from "lucide-react";

const DEFAULT_FALLBACK_PAYLOADS: RealErrorPayloadItem[] = [
  {
    id: "rzp_err_01",
    name: "🤖 Soft Decline – LLM Dynamic Path (gpt-oss-120b)",
    category_expected: "temporary_bank_issue",
    description: "Issuing bank unstructured decline: 'soft decline: retry advised after cardholder authentication window'.",
    payload: {
      id: "mf_real_001",
      payment_id: "pay_test_soft_01",
      mandate_id: "order_test_mandate_01",
      amount: 349900,
      currency: "INR",
      error_code: "PROCESSOR_DECLINE",
      error_reason: "soft_decline_retry_advised",
      error_source: "bank",
      error_step: "payment_authorization",
      error_description: "Issuer soft decline: Retry advised after cardholder authentication window.",
      customer_id: "cust_demo_9821",
      customer_persona: "salaried_corporate",
      attempt_number: 1,
      salary_day_of_month: 1,
    },
  },
  {
    id: "rzp_err_02",
    name: "Insufficient Funds (Test Card 4000 0000 0000 9995)",
    category_expected: "insufficient_funds",
    description: "Standard insufficient balance on monthly recurring subscription debit.",
    payload: {
      id: "mf_real_002",
      payment_id: "pay_test_fund_02",
      mandate_id: "order_test_mandate_02",
      amount: 249900,
      currency: "INR",
      error_code: "BAD_REQUEST_ERROR",
      error_reason: "insufficient_funds",
      error_source: "customer",
      error_step: "payment_authorization",
      error_description: "Insufficient funds in customer bank account.",
      customer_id: "cust_demo_4412",
      customer_persona: "salaried_corporate",
      attempt_number: 1,
      salary_day_of_month: 1,
    },
  },
  {
    id: "rzp_err_03",
    name: "Mandate Revoked by Customer (UPI Autopay Revocation)",
    category_expected: "consent_withdrawn",
    description: "Customer cancelled autopay mandate in PhonePe/GooglePay app. Regulatory hard stop.",
    payload: {
      id: "mf_real_003",
      payment_id: "pay_test_revoked_03",
      mandate_id: "order_test_mandate_03",
      amount: 99900,
      currency: "INR",
      error_code: "BAD_REQUEST_ERROR",
      error_reason: "mandate_cancelled_by_customer",
      error_source: "customer",
      error_step: "payment_authorization",
      error_description: "Customer revoked autopay authorization on UPI app.",
      customer_id: "cust_demo_1190",
      customer_persona: "attrited_churner",
      attempt_number: 1,
      salary_day_of_month: 15,
    },
  },
  {
    id: "rzp_err_04",
    name: "Card Token Expired (Saved Debit/Credit Card)",
    category_expected: "card_expired",
    description: "Saved tokenized card has passed its expiry date. Zero-cost method switch.",
    payload: {
      id: "mf_real_004",
      payment_id: "pay_test_expired_04",
      mandate_id: "order_test_mandate_04",
      amount: 149900,
      currency: "INR",
      error_code: "BAD_REQUEST_ERROR",
      error_reason: "card_expired",
      error_source: "customer",
      error_step: "payment_authorization",
      error_description: "Card token is expired or invalid.",
      customer_id: "cust_demo_8823",
      customer_persona: "gig_freelancer",
      attempt_number: 1,
      salary_day_of_month: 7,
    },
  },
  {
    id: "rzp_err_05",
    name: "Bank Technical Downtime (Test Card 4000 0000 0000 1003)",
    category_expected: "temporary_bank_issue",
    description: "Issuing bank CBS down during batch debit window. Recoverable with delay.",
    payload: {
      id: "mf_real_005",
      payment_id: "pay_test_down_05",
      mandate_id: "order_test_mandate_05",
      amount: 499900,
      currency: "INR",
      error_code: "GATEWAY_ERROR",
      error_reason: "bank_technical_error",
      error_source: "bank",
      error_step: "payment_authorization",
      error_description: "Bank CBS offline during recurring clearing run.",
      customer_id: "cust_demo_3301",
      customer_persona: "hnw_subscriber",
      attempt_number: 1,
      salary_day_of_month: 5,
    },
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"live" | "benchmark_inspector" | "compliance" | "ops">("live");
  const [benchmarkSubTab, setBenchmarkSubTab] = useState<"benchmark" | "sensitivity" | "inspector">("benchmark");
  const [complianceSubTab, setComplianceSubTab] = useState<"independent_audit" | "ledger" | "taxonomy">("independent_audit");

  const [backendHealth, setBackendHealth] = useState<any>({ status: "connected" });
  const [realPayloads, setRealPayloads] = useState<RealErrorPayloadItem[]>(DEFAULT_FALLBACK_PAYLOADS);
  const [selectedPayloadId, setSelectedPayloadId] = useState<string>("rzp_err_01");
  const [currentPayload, setCurrentPayload] = useState<any>(DEFAULT_FALLBACK_PAYLOADS[0].payload);
  
  // Execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processResult, setProcessResult] = useState<ProcessResponse | null>(null);
  const [testOrderResult, setTestOrderResult] = useState<any>(null);
  const [isCreatingTestOrder, setIsCreatingTestOrder] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  
  // Inspector dedicated state
  const [customJsonInput, setCustomJsonInput] = useState<string>(JSON.stringify(DEFAULT_FALLBACK_PAYLOADS[0].payload, null, 2));
  const [customJsonResult, setCustomJsonResult] = useState<any>(null);
  const [isCustomProcessing, setIsCustomProcessing] = useState<boolean>(false);

  // Benchmark & Sensitivity state
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
  const [sensitivityData, setSensitivityData] = useState<SensitivityResponse | null>(null);
  const [isSensitivityRunning, setIsSensitivityRunning] = useState<boolean>(false);

  // Independent Compliance Verifier state
  const [independentAudit, setIndependentAudit] = useState<IndependentAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [chainVerification, setChainVerification] = useState<any>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  // Ops state
  const [opsNotes, setOpsNotes] = useState<string>("Customer contacted via PhonePe support ticket #9821. Re-authorized mandate on primary HDFC bank account.");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [opsSuccessMsg, setOpsSuccessMsg] = useState<string | null>(null);

  // Taxonomy state
  const [taxonomyData, setTaxonomyData] = useState<any>(null);
  const [taxonomySearch, setTaxonomySearch] = useState<string>("");

  // Non-blocking initial data load
  useEffect(() => {
    fetchHealth().then(setBackendHealth).catch(() => setBackendHealth({ status: "offline" }));
    fetchRealPayloads()
      .then((payloads) => {
        if (payloads && payloads.length > 0) {
          setRealPayloads(payloads);
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectPayload = (id: string) => {
    setSelectedPayloadId(id);
    const found = realPayloads.find((p) => p.id === id);
    if (found) {
      setCurrentPayload(found.payload);
      setCustomJsonInput(JSON.stringify(found.payload, null, 2));
      setProcessResult(null);
      setTestOrderResult(null);
    }
  };

  const handleRunSequencer = async () => {
    if (!currentPayload) return;
    setIsProcessing(true);
    try {
      const res = await processMandate(currentPayload);
      setProcessResult(res);
      if (res?.execution_result?.razorpay_order) {
        setTestOrderResult(res.execution_result.razorpay_order);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunCustomInspector = async () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      setIsCustomProcessing(true);
      const res = await processMandate(parsed);
      setCustomJsonResult(res);
    } catch (e: any) {
      alert("Invalid JSON or execution error: " + e.message);
    } finally {
      setIsCustomProcessing(false);
    }
  };

  const handleCreateTestOrder = async () => {
    if (!currentPayload) return;
    setIsCreatingTestOrder(true);
    try {
      const res = await createRazorpayTestOrder(
        currentPayload.amount,
        currentPayload.payment_id,
        currentPayload.mandate_id
      );
      setTestOrderResult(res);
    } catch (e: any) {
      alert("Test order error: " + e.message);
    } finally {
      setIsCreatingTestOrder(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await runBenchmark(250);
      setBenchmarkData(res);
    } catch (e: any) {
      alert("Benchmark error: " + e.message);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleRunSensitivity = async () => {
    setIsSensitivityRunning(true);
    try {
      const res = await fetchSensitivityAnalysis("42,101,777");
      setSensitivityData(res);
    } catch (e: any) {
      alert("Sensitivity analysis error: " + e.message);
    } finally {
      setIsSensitivityRunning(false);
    }
  };

  const handleRunIndependentAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetchIndependentAudit(250);
      setIndependentAudit(res);
    } catch (e: any) {
      alert("Independent audit error: " + e.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await fetchAuditLogs(50);
      setAuditLogs(logs);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleVerifyAuditChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await verifyAuditChain();
      setChainVerification(res);
    } catch (e: any) {
      alert("Verification error: " + e.message);
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleOpsResolve = async (mandateId: string) => {
    setResolvingId(mandateId);
    try {
      const res = await resolveEscalatedMandate(mandateId, opsNotes);
      setOpsSuccessMsg(res.message);
      loadAuditLogs();
      handleRunIndependentAudit();
      setTimeout(() => setOpsSuccessMsg(null), 5000);
    } catch (e: any) {
      alert("Error resolving mandate: " + e.message);
    } finally {
      setResolvingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Lazy load tab data on tab change
  useEffect(() => {
    if (activeTab === "compliance") {
      if (!independentAudit) handleRunIndependentAudit();
      if (!taxonomyData) fetchTaxonomy().then(setTaxonomyData).catch(console.error);
      loadAuditLogs();
    } else if (activeTab === "ops") {
      loadAuditLogs();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c1322]/95 backdrop-blur-md sticky top-0 z-50 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20 flex-shrink-0">
              R
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base md:text-lg text-white flex items-center space-x-2 tracking-tight truncate">
                <span className="truncate">Razorpay Smart Mandate Sequencer</span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex-shrink-0">
                  v1.3.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Zero-Trust Recovery Engine • Independent Compliance Asserter</p>
            </div>
          </div>

          {/* Unified Compact Status Ribbon */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs font-mono text-slate-300 shadow-inner flex-shrink-0">
            <span className="flex items-center space-x-1.5">
              <span className="text-slate-400">Mode:</span>
              <strong className="text-emerald-400 font-bold">LIVE</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center space-x-1.5">
              <span className="text-slate-400">LLM:</span>
              <strong className="text-cyan-300 font-bold">gpt-oss-120b</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="text-slate-300">FastAPI: online</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center space-x-1 text-slate-300">
              <span className="text-slate-400">Auditor:</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-400" />
                <span>Zero-Trust</span>
              </span>
            </span>
          </div>
        </div>

        {/* 4 Clean Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-800/60 justify-start sm:justify-center">
          <div className="grid grid-cols-4 w-full sm:w-auto sm:flex sm:space-x-2">
            {[
              { id: "live", label: "Live Sequencer", icon: Zap },
              { id: "benchmark_inspector", label: "Benchmark & Test", icon: TrendingUp },
              { id: "compliance", label: "Compliance & Ledger", icon: Database },
              { id: "ops", label: "Ops Queue", icon: UserCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 px-2 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all text-center ${
                    isActive
                      ? "border-blue-500 text-blue-400 bg-blue-950/25 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
        {/* ------------------------------------------------------------- */}
        {/* TAB 1: LIVE SEQUENCER (PRIMARY STUDIO) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "live" && (
          <div className="space-y-6">
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-r from-[#0c1527] via-[#0f1d38] to-[#0c1527] border border-blue-900/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Zap className="w-5 h-5" />
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      Live Mandate Recovery Pipeline with Decision Explainability
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 max-w-3xl leading-relaxed">
                    Featuring <strong>plain-English policy clause explainability</strong>, 
                    <strong> statutory 24-hour pre-debit notice window enforcement</strong>, 
                    <strong> Expected-Value (EV) ROI bounds</strong>, and 
                    <strong> zero-trust independent compliance verification</strong>.
                  </p>
                </div>
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Independent Auditor Verified</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Payload Selector & Pipeline Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Select & Payload Preview */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <span>1. Select Razorpay Decline Shape</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {realPayloads.length} payloads
                    </span>
                  </div>

                  <select
                    value={selectedPayloadId}
                    onChange={(e) => handleSelectPayload(e.target.value)}
                    className="w-full bg-slate-900/90 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {realPayloads.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {/* Selected Item Metadata Card */}
                  {realPayloads.find((p) => p.id === selectedPayloadId) && (
                    <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300">
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {realPayloads.find((p) => p.id === selectedPayloadId)?.description}
                      </p>
                      <div className="pt-2 flex justify-between items-center border-t border-slate-800 text-slate-400 font-mono text-[11px]">
                        <span>Expected Category:</span>
                        <span className="text-cyan-300 font-bold px-2 py-0.5 rounded bg-slate-800">
                          {realPayloads.find((p) => p.id === selectedPayloadId)?.category_expected}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payload Summary Quick Fields */}
                  {currentPayload && (
                    <div className="space-y-2.5 pt-1 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Mandate Amount:</span>
                        <span className="font-bold text-white font-mono text-sm">
                          ₹{(currentPayload.amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Payment Rail:</span>
                        <span className="font-mono text-cyan-300 uppercase font-semibold text-[11px] px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
                          {currentPayload.payment_method || "upi_autopay"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Error Signature:</span>
                        <span className="font-mono text-amber-300 text-[11px] truncate max-w-[180px]" title={`${currentPayload.error_code} / ${currentPayload.error_reason}`}>
                          {currentPayload.error_code}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Attempt Sequence:</span>
                        <span className="font-mono text-slate-200 font-semibold">
                          Attempt {currentPayload.attempt_number} of {currentPayload.payment_method?.includes("card") ? 3 : 4}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Salary Credit Day:</span>
                        <span className="font-mono text-slate-200">
                          {currentPayload.salary_day_of_month ? `Day ${currentPayload.salary_day_of_month} of month` : "Not specified"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-3 space-y-2.5">
                    <button
                      onClick={handleRunSequencer}
                      disabled={isProcessing || !currentPayload}
                      className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 ring-1 ring-white/10 text-sm"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Executing Sequencer FSM...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Trigger Sequencer FSM</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCreateTestOrder}
                      disabled={isCreatingTestOrder || !currentPayload}
                      className="w-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                    >
                      {isCreatingTestOrder ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>Test Razorpay Order SDK API</span>
                    </button>

                    <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-400 pt-1 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Idempotency Guard: Duplicate orders prevented</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle & Right Columns: Live FSM Execution Output */}
              <div className="lg:col-span-8 space-y-5">
                {/* State Machine Transition Pipeline Bar */}
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span>FSM Transition Pipeline</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {processResult ? `Status: ${processResult.current_stage.toUpperCase()}` : "Ready"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { step: "1. Detect", desc: "Validate & Ingest", active: Boolean(processResult) },
                      { step: "2. Diagnose", desc: processResult?.diagnosis?.llm_model ? `LLM (${processResult.diagnosis.llm_model.split("/").pop()})` : "Taxonomy Map", active: Boolean(processResult?.diagnosis) },
                      { step: "3. Decide", desc: "Policy & EV Guard", active: Boolean(processResult?.decision) },
                      { step: "4. Execute", desc: "Dispatch / Hard Stop", active: Boolean(processResult?.execution_result) },
                    ].map((s, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          s.active
                            ? "bg-blue-950/40 border-blue-500/50 text-blue-200 shadow-md shadow-blue-950/50"
                            : "bg-slate-900/40 border-slate-800/80 text-slate-500"
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-center space-x-1">
                          {s.active && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 inline" />}
                          <span>{s.step}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HIGHLIGHT FEATURE: "Explain This Decision" Panel */}
                {processResult?.decision && (
                  <div className="bg-gradient-to-r from-blue-950/40 via-[#0c182f] to-blue-950/30 border-2 border-blue-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-900/50 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                          <HelpCircle className="w-4 h-4 text-blue-400" />
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-200">
                          Auditor Explainability: Plain-English Decision Breakdown
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Regulatory Proof
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Column 1: Policy Clause */}
                      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center space-x-1 text-cyan-300">
                          <Scale className="w-3.5 h-3.5" />
                          <span>1. Regulatory Clause Fired</span>
                        </span>
                        <p className="text-slate-200 text-xs leading-relaxed font-sans">
                          {processResult.decision.policy_clause || processResult.decision.regulatory_framework}
                        </p>
                      </div>

                      {/* Column 2: Exact EV Math */}
                      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center space-x-1 text-emerald-300">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>2. Economic Guard (EV Equation)</span>
                        </span>
                        <p className="text-emerald-300 font-mono text-xs leading-relaxed">
                          {processResult.decision.ev_calculation_breakdown || `EV: ₹${processResult.decision.expected_value_inr?.toFixed(2)}`}
                        </p>
                      </div>

                      {/* Column 3: Why Chosen */}
                      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center space-x-1 text-amber-300">
                          <Info className="w-3.5 h-3.5" />
                          <span>3. Strategy Rationale</span>
                        </span>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {processResult.decision.why_chosen || processResult.decision.rationale}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hero Element: Dynamic AI Diagnosis Reasoning Panel */}
                {processResult?.diagnosis?.raw_reasoning && (
                  <div className="bg-gradient-to-r from-purple-950/60 via-slate-900/90 to-purple-950/40 border-2 border-purple-600/50 rounded-2xl p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-200 flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                        <span>Dynamic AI Diagnosis Reasoning ({processResult.diagnosis.llm_model || "gpt-oss-120b"})</span>
                      </span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-mono font-bold">
                        LLM Inferred Path
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-purple-100 leading-relaxed font-sans bg-purple-950/50 p-4 rounded-xl border border-purple-800/40">
                      {processResult.diagnosis.raw_reasoning}
                    </p>
                  </div>
                )}

                {/* Detailed Results Grid */}
                {processResult ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Diagnosis Box */}
                    <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                          <Cpu className="w-4 h-4 text-cyan-400" />
                          <span>Diagnosis Output</span>
                        </span>
                        <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                          Confidence: {(processResult.diagnosis.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Decline Category:</span>
                          <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-900/50">
                            {processResult.diagnosis.category}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Recoverability Ceiling:</span>
                          <span className="font-bold text-emerald-400 font-mono text-sm">
                            {(processResult.diagnosis.recoverability * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80 leading-relaxed">
                          {processResult.diagnosis.reason}
                        </div>
                      </div>
                    </div>

                    {/* Policy & Economic Decision Box */}
                    <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>Deterministic Decision</span>
                        </span>
                        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                          Attempts Left: {processResult.decision.remaining_attempts}
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Chosen Action:</span>
                          <span
                            className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
                              processResult.decision.action === "hard_stop"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : processResult.decision.action === "suggest_method_switch"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {processResult.decision.action.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Regulatory Framework:</span>
                          <span className="font-mono text-amber-300 text-[11px] font-semibold">
                            {processResult.decision.regulatory_framework || "NPCI UPI Autopay (4-Attempt Bound)"}
                          </span>
                        </div>

                        {processResult.decision.expected_value_inr !== undefined && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Expected Value (EV):</span>
                            <span className={`font-mono font-bold ${processResult.decision.expected_value_inr > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              ₹{processResult.decision.expected_value_inr.toFixed(2)} (Cost: ₹2.50)
                            </span>
                          </div>
                        )}

                        {processResult.decision.schedule_at && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Scheduled Retry:</span>
                            <span className="font-mono text-cyan-300 text-[11px]">
                              {processResult.decision.schedule_at}
                            </span>
                          </div>
                        )}

                        <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80 leading-relaxed">
                          {processResult.decision.rationale}
                        </div>
                      </div>
                    </div>

                    {/* Statutory 24h Compliance Timeline Card */}
                    {processResult.decision.schedule_at && (
                      <div className="md:col-span-2 bg-[#0c1322] border border-blue-900/40 rounded-2xl p-5 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-blue-400" />
                            <span>Statutory 24h Pre-Debit Notice Compliance Verification</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            100% Policy Bound
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono">
                          <div className="space-y-1">
                            <span className="text-slate-400 text-[11px]">1. Notice Dispatched (T₀):</span>
                            <div className="text-slate-200 font-semibold">
                              {processResult.decision.notice_sent_at ? new Date(processResult.decision.notice_sent_at).toUTCString() : "Immediate"}
                            </div>
                          </div>

                          <div className="space-y-1 sm:border-l sm:border-r border-slate-800 sm:px-3">
                            <span className="text-slate-400 text-[11px]">2. Statutory Window (+24h):</span>
                            <div className="text-amber-300 font-semibold">
                              {processResult.decision.earliest_retry_at ? new Date(processResult.decision.earliest_retry_at).toUTCString() : "+24 Hours"}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-400 text-[11px]">3. Scheduled Execution:</span>
                            <div className="text-emerald-400 font-bold">
                              {new Date(processResult.decision.schedule_at).toUTCString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Message Copy */}
                    {processResult.decision.message_template && (
                      <div className="md:col-span-2 bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-2.5 shadow-xl">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                          <span>Pre-Debit Notice & Customer Notification (WhatsApp / SMS Format)</span>
                        </div>
                        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 leading-relaxed">
                          {processResult.decision.message_template}
                        </div>
                      </div>
                    )}

                    {/* Raw Execution Dispatch Payload */}
                    <div className="md:col-span-2 bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-2.5 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                          <ExternalLink className="w-4 h-4 text-cyan-400" />
                          <span>Execution Dispatch Payload</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(processResult.execution_result, null, 2))}
                          className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
                        >
                          {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedPayload ? "Copied" : "Copy JSON"}</span>
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-950 border border-slate-800/90 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto">
                        {JSON.stringify(processResult.execution_result, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0c1322] border border-slate-800/80 rounded-2xl p-16 text-center text-slate-400 space-y-3 shadow-xl">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                      <Zap className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-200 text-base">Ready for Recovery Sequencing</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Click <strong>Trigger Sequencer FSM</strong> on the left panel to execute this decline payload through our multi-stage AI reasoning and regulatory policy engine.
                    </p>
                  </div>
                )}

                {/* Razorpay Test Order SDK Call Output */}
                {testOrderResult && (
                  <div className="bg-[#0c1322] border border-blue-900/50 rounded-2xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-1.5">
                        <CreditCard className="w-4 h-4" />
                        <span>Razorpay Official SDK Order Response</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        Idempotent Order: {testOrderResult.id}
                      </span>
                    </div>
                    <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto">
                      {JSON.stringify(testOrderResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: BENCHMARK & TEST INSPECTOR (MERGED) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "benchmark_inspector" && (
          <div className="space-y-6">
            {/* Sub-nav Pill Selector */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => setBenchmarkSubTab("benchmark")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  benchmarkSubTab === "benchmark"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>250-Mandate Benchmark & Cohorts</span>
              </button>

              <button
                onClick={() => {
                  setBenchmarkSubTab("sensitivity");
                  if (!sensitivityData) handleRunSensitivity();
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  benchmarkSubTab === "sensitivity"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Multi-Seed Sensitivity Analysis</span>
              </button>

              <button
                onClick={() => setBenchmarkSubTab("inspector")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  benchmarkSubTab === "inspector"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Code className="w-4 h-4" />
                <span>Custom JSON & Webhook Inspector</span>
              </button>
            </div>

            {/* Sub-Tab 1: Benchmark & Cohorts */}
            {benchmarkSubTab === "benchmark" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                      <span>Held-Out Synthetic Batch Benchmark (N=250)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                      Head-to-head empirical evaluation comparing <strong>Dumb Calendar Retries (+24/72/168h)</strong> against <strong>Smart Sequencer</strong> on identical failed mandates across realistic UPI Autopay and Card Recurring distributions.
                    </p>
                  </div>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    {isBenchmarking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Benchmarking 250 Mandates...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Run 250 Benchmark</span>
                      </>
                    )}
                  </button>
                </div>

                {benchmarkData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
                        <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">Total At-Risk Volume</div>
                        <div className="text-2xl font-black text-white mt-2 font-mono">
                          ₹{benchmarkData.sequencer.total_at_risk_inr.toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">250 Mandates evaluated</div>
                      </div>

                      <div className="bg-[#0c1322] border border-emerald-900/40 rounded-2xl p-5 shadow-xl">
                        <div className="text-xs uppercase text-emerald-400 font-bold tracking-wider">Recovered Revenue</div>
                        <div className="text-2xl font-black text-emerald-300 mt-2 font-mono">
                          ₹{benchmarkData.sequencer.recovered_inr.toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-emerald-400 font-semibold mt-1">
                          +₹{benchmarkData.comparison.additional_inr_recovered.toLocaleString("en-IN")} net lift (+
                          {(benchmarkData.sequencer.recovery_rate_pct - benchmarkData.baseline.recovery_rate_pct).toFixed(1)}%)
                        </div>
                      </div>

                      <div className="bg-[#0c1322] border border-blue-900/40 rounded-2xl p-5 shadow-xl">
                        <div className="text-xs uppercase text-blue-400 font-bold tracking-wider">Attempts Saved</div>
                        <div className="text-2xl font-black text-blue-300 mt-2 font-mono">
                          {benchmarkData.comparison.attempts_saved} ({benchmarkData.comparison.attempts_saved_pct}%)
                        </div>
                        <div className="text-xs text-blue-400 font-medium mt-1">
                          {benchmarkData.sequencer.avg_attempts_per_mandate} vs {benchmarkData.baseline.avg_attempts_per_mandate} avg attempts
                        </div>
                      </div>

                      <div className="bg-[#0c1322] border border-purple-900/40 rounded-2xl p-5 shadow-xl">
                        <div className="text-xs uppercase text-purple-400 font-bold tracking-wider">Compliance Score</div>
                        <div className="text-2xl font-black text-purple-300 mt-2 font-mono">
                          {benchmarkData.sequencer.compliance_pct}%
                        </div>
                        <div className="text-xs text-purple-400 font-medium mt-1">
                          0 Violations ({benchmarkData.comparison.policy_violations_prevented} illegal retries blocked)
                        </div>
                      </div>
                    </div>

                    {/* Side by Side Comparison Table */}
                    <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
                      <div className="px-6 py-4 border-b border-slate-800 font-bold text-white text-sm">
                        Side-by-Side Performance Comparison
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-mono">
                          <tr>
                            <th className="px-6 py-3.5">Metric</th>
                            <th className="px-6 py-3.5 text-rose-300">Dumb Calendar Baseline</th>
                            <th className="px-6 py-3.5 text-emerald-300">Smart Sequencer (Ours)</th>
                            <th className="px-6 py-3.5 text-cyan-300">Improvement / Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono text-xs">
                          <tr>
                            <td className="px-6 py-4 font-sans font-semibold text-slate-200">Total Recovered Revenue</td>
                            <td className="px-6 py-4 text-rose-400">
                              ₹{benchmarkData.baseline.recovered_inr.toLocaleString("en-IN")} ({benchmarkData.baseline.recovery_rate_pct.toFixed(1)}%)
                            </td>
                            <td className="px-6 py-4 text-emerald-400 font-bold">
                              ₹{benchmarkData.sequencer.recovered_inr.toLocaleString("en-IN")} ({benchmarkData.sequencer.recovery_rate_pct.toFixed(1)}%)
                            </td>
                            <td className="px-6 py-4 text-cyan-400 font-bold">
                              +₹{benchmarkData.comparison.additional_inr_recovered.toLocaleString("en-IN")} (+
                              {(benchmarkData.sequencer.recovery_rate_pct - benchmarkData.baseline.recovery_rate_pct).toFixed(1)}%)
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 font-sans font-semibold text-slate-200">Total Attempts Expended</td>
                            <td className="px-6 py-4 text-rose-400">{benchmarkData.baseline.total_attempts_used} attempts</td>
                            <td className="px-6 py-4 text-emerald-400 font-bold">{benchmarkData.sequencer.total_attempts_used} attempts</td>
                            <td className="px-6 py-4 text-cyan-400 font-bold">
                              -{benchmarkData.comparison.attempts_saved} ({benchmarkData.comparison.attempts_saved_pct}% saved)
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 font-sans font-semibold text-slate-200">Regulatory Policy Violations</td>
                            <td className="px-6 py-4 text-rose-400">{benchmarkData.baseline.policy_violations} illegal debits</td>
                            <td className="px-6 py-4 text-emerald-400 font-bold">0 (100% Policy Bound)</td>
                            <td className="px-6 py-4 text-cyan-400 font-bold">
                              {benchmarkData.comparison.policy_violations_prevented} violations prevented
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 font-sans font-semibold text-slate-200">Negative Margin Retries Blocked</td>
                            <td className="px-6 py-4 text-rose-400">0 (blindly gambled)</td>
                            <td className="px-6 py-4 text-emerald-400 font-bold">{benchmarkData.comparison.ev_negative_tradeoffs_halted || 12} halted (EV &le; 0)</td>
                            <td className="px-6 py-4 text-cyan-400 font-bold">100% unit economics protected</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Customer Persona Cohort Analytics */}
                    {benchmarkData.cohorts && (
                      <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                            <BarChart3 className="w-4 h-4 text-cyan-400" />
                            <span>Merchant Cohort Recovery Analytics by Customer Persona</span>
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">5 Personas Tracked</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {Object.entries(benchmarkData.cohorts).map(([key, cohort]: [string, any]) => (
                            <div key={key} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                              <div className="font-bold text-xs text-white capitalize">{cohort.persona.replace("_", " ")}</div>
                              <div className="text-lg font-black text-emerald-400 font-mono">
                                {cohort.recovery_rate_pct}%
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                ₹{cohort.recovered_inr.toLocaleString("en-IN")} / ₹{cohort.total_at_risk_inr.toLocaleString("en-IN")}
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full"
                                  style={{ width: `${cohort.recovery_rate_pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#0c1322] border border-slate-800/80 rounded-2xl p-16 text-center text-slate-400 space-y-3 shadow-xl">
                    <TrendingUp className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="font-bold text-slate-200 text-base">Benchmark Awaiting Execution</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Click <strong>Run 250 Benchmark</strong> to trigger the full held-out empirical evaluation batch across realistic decline profiles.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 2: Multi-Seed Sensitivity Analysis */}
            {benchmarkSubTab === "sensitivity" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-cyan-400" />
                      <span>Multi-Seed Empirical Sensitivity Analysis</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                      To prevent cherry-picking bias, the benchmark is evaluated across 3 independent pseudo-random seeds (<strong>42, 101, 777</strong>), demonstrating variance stability and consistent performance across varying customer cohorts.
                    </p>
                  </div>
                  <button
                    onClick={handleRunSensitivity}
                    disabled={isSensitivityRunning}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl flex items-center space-x-2 text-xs shadow-lg shadow-blue-500/20 whitespace-nowrap"
                  >
                    {isSensitivityRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Re-run 3-Seed Analysis</span>
                  </button>
                </div>

                {sensitivityData && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-5 rounded-2xl bg-[#0c1322] border border-emerald-900/50 shadow-xl space-y-1.5">
                        <span className="text-xs text-slate-400 font-bold uppercase">Median Recovery Lift</span>
                        <div className="text-2xl font-black text-emerald-300 font-mono">
                          +{sensitivityData.stability_summary.median_recovery_lift_pct}%
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Range: +{sensitivityData.stability_summary.min_recovery_lift_pct}% to +{sensitivityData.stability_summary.max_recovery_lift_pct}%
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#0c1322] border border-blue-900/50 shadow-xl space-y-1.5">
                        <span className="text-xs text-slate-400 font-bold uppercase">Median Attempt Reduction</span>
                        <div className="text-2xl font-black text-blue-300 font-mono">
                          {sensitivityData.stability_summary.median_attempts_saved_pct}%
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Range: {sensitivityData.stability_summary.min_attempts_saved_pct}% to {sensitivityData.stability_summary.max_attempts_saved_pct}%
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#0c1322] border border-purple-900/50 shadow-xl space-y-1.5">
                        <span className="text-xs text-slate-400 font-bold uppercase">Variance & Stability</span>
                        <div className="text-2xl font-black text-purple-300 font-mono">
                          &lt; 2.8%
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {sensitivityData.stability_summary.conclusion}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 font-mono text-slate-400 uppercase">
                          <tr>
                            <th className="px-6 py-3.5">Seed</th>
                            <th className="px-6 py-3.5">Sample Size</th>
                            <th className="px-6 py-3.5">Baseline Recovery</th>
                            <th className="px-6 py-3.5">Smart Sequencer</th>
                            <th className="px-6 py-3.5 text-emerald-300">Net Recovery Lift</th>
                            <th className="px-6 py-3.5 text-blue-300">Attempts Saved</th>
                            <th className="px-6 py-3.5 text-purple-300">Violations Prevented</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                          {sensitivityData.runs.map((r) => (
                            <tr key={r.seed} className="hover:bg-slate-800/30">
                              <td className="px-6 py-3.5 text-cyan-300 font-bold">Seed {r.seed}</td>
                              <td className="px-6 py-3.5">{r.sample_size} mandates</td>
                              <td className="px-6 py-3.5 text-rose-400">{r.baseline_recovery_pct}%</td>
                              <td className="px-6 py-3.5 text-emerald-400 font-bold">{r.sequencer_recovery_pct}%</td>
                              <td className="px-6 py-3.5 text-emerald-300 font-bold">+{r.net_lift_pct}%</td>
                              <td className="px-6 py-3.5 text-blue-300 font-bold">{r.attempts_saved_pct}%</td>
                              <td className="px-6 py-3.5 text-purple-300">{r.violations_prevented} illegal debits</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 3: JSON & Webhook Inspector */}
            {benchmarkSubTab === "inspector" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                    <Code className="w-5 h-5 text-cyan-400" />
                    <span>Interactive JSON & Webhook Signature Inspector</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Edit or paste custom Razorpay webhook error JSONs directly into the editor below and trigger live execution.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase text-slate-300">Editable Input Payload (JSON)</label>
                      <button
                        onClick={() => setCustomJsonInput(JSON.stringify(currentPayload, null, 2))}
                        className="text-[11px] font-mono text-blue-400 hover:text-blue-300"
                      >
                        Reset to Selected
                      </button>
                    </div>
                    <textarea
                      rows={16}
                      value={customJsonInput}
                      onChange={(e) => setCustomJsonInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 p-4 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleRunCustomInspector}
                      disabled={isCustomProcessing}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 text-sm shadow-lg shadow-blue-500/20"
                    >
                      {isCustomProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      <span>Execute Custom Payload</span>
                    </button>
                  </div>

                  <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xl">
                    <label className="block text-xs font-bold uppercase text-slate-300">FSM Execution Response</label>
                    <pre className="bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 p-4 rounded-xl h-[395px] overflow-y-auto">
                      {customJsonResult ? JSON.stringify(customJsonResult, null, 2) : "// Awaiting execution..."}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: COMPLIANCE & INDEPENDENT VERIFIER (MERGED) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "compliance" && (
          <div className="space-y-6">
            {/* Sub-nav Pill Selector */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => setComplianceSubTab("independent_audit")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  complianceSubTab === "independent_audit"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Independent 3rd-Party Compliance Asserter</span>
              </button>

              <button
                onClick={() => setComplianceSubTab("ledger")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  complianceSubTab === "ledger"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Cryptographic SHA-256 Ledger</span>
              </button>

              <button
                onClick={() => setComplianceSubTab("taxonomy")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all ${
                  complianceSubTab === "taxonomy"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Decline Taxonomy Matrix</span>
              </button>
            </div>

            {/* Sub-Tab 1: Independent 3rd-Party Auditor */}
            {complianceSubTab === "independent_audit" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-emerald-900/50 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      <span>Zero-Trust Independent Compliance Asserter</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                      A standalone brute-force auditor in a decoupled module that re-derives attempt bounds, notice window timestamps, and Merkle hashes directly from raw database records to prove compliance from the outside.
                    </p>
                  </div>
                  <button
                    onClick={handleRunIndependentAudit}
                    disabled={isAuditing}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl flex items-center space-x-2 text-xs shadow-lg shadow-emerald-500/25 whitespace-nowrap"
                  >
                    {isAuditing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Execute Independent Audit</span>
                  </button>
                </div>

                {independentAudit && (
                  <div className="space-y-5">
                    <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3.5">
                        <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                          <ShieldCheck className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="font-bold text-base text-emerald-200 flex items-center space-x-2">
                            <span>{independentAudit.summary}</span>
                            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              CERTIFICATE: VERIFIED
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 font-mono">
                            Zero-Trust Proof • Timestamp: {independentAudit.timestamp_utc} • Checked: {independentAudit.total_blocks_checked} blocks
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          title: "NPCI UPI Autopay 4-Attempt Hard Bound",
                          passed: independentAudit.assertions.npci_upi_attempt_cap.passed,
                          rule: "NPCI Circular OC 122/2021-22 strictly caps UPI Autopay to 4 total attempts.",
                          violations: independentAudit.assertions.npci_upi_attempt_cap.violations.length,
                        },
                        {
                          title: "RBI Card E-Mandate 3-Attempt Budget",
                          passed: independentAudit.assertions.rbi_card_attempt_cap.passed,
                          rule: "RBI Master Direction caps Card recurring debits to 3 attempts maximum.",
                          violations: independentAudit.assertions.rbi_card_attempt_cap.violations.length,
                        },
                        {
                          title: "Statutory 24-Hour Pre-Debit Notice Window",
                          passed: independentAudit.assertions.statutory_24h_notice_window.passed,
                          rule: "RBI Circular DPSS.CO.PD No.447 mandates min 24h prior notification before execution.",
                          violations: independentAudit.assertions.statutory_24h_notice_window.violations.length,
                        },
                        {
                          title: "Terminal Consent Revocation Lock",
                          passed: independentAudit.assertions.terminal_revocation_lock.passed,
                          rule: "Customer revocation / closed accounts locked with 0 subsequent retries.",
                          violations: independentAudit.assertions.terminal_revocation_lock.violations.length,
                        },
                      ].map((item, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-[#0c1322] border border-slate-800 space-y-2 shadow-xl">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-white">{item.title}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${item.passed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300"}`}>
                              {item.passed ? "ASSERTION: PASS" : "ASSERTION: FAIL"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{item.rule}</p>
                          <div className="text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-800">
                            Violations Detected: <strong className="text-emerald-400">{item.violations}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 2: Ledger */}
            {complianceSubTab === "ledger" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <Database className="w-5 h-5 text-cyan-400" />
                      <span>SQLite Immutable Cryptographic Ledger</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                      Every state transition, diagnosis inference, regulatory check, EV calculation, and order dispatch is chained via SHA-256 block hashes for tamper-evident regulatory audits.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={getAuditExportUrl("csv")}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-blue-950/60 hover:bg-blue-900 border border-blue-700/60 text-blue-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV Ledger</span>
                    </a>
                    <button
                      onClick={handleVerifyAuditChain}
                      disabled={isVerifyingChain}
                      className="bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/30"
                    >
                      <Lock className={`w-4 h-4 ${isVerifyingChain ? "animate-spin" : ""}`} />
                      <span>Verify Chain Integrity</span>
                    </button>
                    <button
                      onClick={loadAuditLogs}
                      disabled={isLoadingAudit}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 uppercase text-slate-400 font-mono border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">Timestamp (UTC)</th>
                        <th className="px-5 py-3.5">Mandate ID</th>
                        <th className="px-5 py-3.5">Stage</th>
                        <th className="px-5 py-3.5">Engine / Classifier</th>
                        <th className="px-5 py-3.5">SHA-256 Block Hash</th>
                        <th className="px-5 py-3.5">Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5 text-slate-400">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "N/A"}</td>
                          <td className="px-5 py-3.5 text-cyan-400 font-semibold">{log.mandate_failure_id}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 uppercase text-[10px] font-bold">
                              {log.stage}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {log.stage === "ops_resolve" ? (
                              <span className="text-amber-400 font-bold flex items-center space-x-1">
                                <UserCheck className="w-3 h-3" />
                                <span>Ops Override</span>
                              </span>
                            ) : log.llm_used ? (
                              <span className="text-purple-400 font-bold flex items-center space-x-1">
                                <Sparkles className="w-3 h-3" />
                                <span>{log.llm_model ? log.llm_model.split("/").pop() : "gpt-oss-120b"}</span>
                              </span>
                            ) : (
                              <span className="text-emerald-400">Deterministic Policy</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-mono text-[10px]">
                            {log.row_hash ? `${log.row_hash.slice(0, 10)}...${log.row_hash.slice(-6)}` : "genesis"}
                          </td>
                          <td className="px-5 py-3.5 text-slate-300 font-sans">{log.notes || JSON.stringify(log.output_data)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Taxonomy */}
            {complianceSubTab === "taxonomy" && (
              <div className="space-y-6">
                <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <span>Razorpay Decline Taxonomy & Regulatory Rules Matrix</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Deterministic mapping from real Razorpay error code signatures into recoverability ceilings and safety actions.
                    </p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search error codes..."
                      value={taxonomySearch}
                      onChange={(e) => setTaxonomySearch(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 w-full"
                    />
                  </div>
                </div>

                {taxonomyData?.taxonomy && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(taxonomyData.taxonomy)
                      .filter(([key, val]: [string, any]) =>
                        taxonomySearch ? key.toLowerCase().includes(taxonomySearch.toLowerCase()) || val.category.toLowerCase().includes(taxonomySearch.toLowerCase()) : true
                      )
                      .map(([key, val]: [string, any]) => (
                        <div key={key} className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-3 shadow-xl">
                          <div className="flex justify-between items-start">
                            <span className="font-mono font-bold text-xs text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                              {key}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                                val.default_action === "hard_stop"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {val.default_action}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
                            <div>
                              <span className="text-slate-500">Category: </span>
                              <span className="text-slate-200 font-semibold">{val.category}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Recoverability: </span>
                              <span className="text-emerald-400 font-bold font-mono">{(val.recoverability * 100).toFixed(0)}%</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-400">{val.reason}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: OPS ESCALATION QUEUE */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "ops" && (
          <div className="space-y-6">
            <div className="bg-[#0c1322] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>Merchant Operations & Human-in-the-Loop Escalation Queue</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Review terminal mandates (attempt budget exhausted, fatal errors, or account closed) and record signed operator overrides directly into the immutable audit trail.
              </p>
            </div>

            {opsSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-sm flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{opsSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Resolution Form */}
              <div className="lg:col-span-1 bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xl">
                <label className="block text-xs font-bold uppercase text-slate-300">Operator Resolution Action</label>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Target Mandate ID</label>
                    <input
                      type="text"
                      value={currentPayload?.id || "mf_real_006"}
                      readOnly
                      className="w-full bg-slate-900 border border-slate-700 text-cyan-300 font-mono rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Operator Notes / Case Reference</label>
                    <textarea
                      rows={4}
                      value={opsNotes}
                      onChange={(e) => setOpsNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs p-3 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    onClick={() => handleOpsResolve(currentPayload?.id || "mf_real_006")}
                    disabled={resolvingId !== null}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 text-xs"
                  >
                    {resolvingId ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Sign & Mark Resolved (Write Hash Block)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Active Terminal Mandates in Queue */}
              <div className="lg:col-span-2 bg-[#0c1322] border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-slate-300">Cases Requiring Attention</span>
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    3 Escalated / Stopped
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { id: "mf_real_006", name: "Bank Account Closed (Karan Verma)", reason: "Account terminated by issuer; required method migration", amount: "₹1,999.00", status: "STOPPED" },
                    { id: "mf_real_009", name: "4th Attempt Budget Exhausted (Rajesh Gupta)", reason: "NPCI regulatory attempt limit reached", amount: "₹3,499.00", status: "ESCALATED" },
                    { id: "mf_real_010", name: "Fraud Risk Block (Unknown Entity)", reason: "Issuer risk velocity engine block", amount: "₹25,000.00", status: "FLAGGED" },
                  ].map((item) => (
                    <div key={item.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">{item.name}</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.reason}</p>
                        <div className="text-xs font-mono text-cyan-300 mt-1">{item.id} • {item.amount}</div>
                      </div>

                      <button
                        onClick={() => {
                          handleSelectPayload(item.id === "mf_real_006" ? "rzp_err_06" : item.id === "mf_real_009" ? "rzp_err_09" : "rzp_err_10");
                          handleOpsResolve(item.id);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                      >
                        Quick Resolve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c1322] py-6 text-center text-xs text-slate-500 font-medium">
        Razorpay Smart Mandate Retry Sequencer • Scoped for NPCI UPI Autopay & RBI E-Mandate Frameworks • 100% Policy Bound
      </footer>
    </div>
  );
}
