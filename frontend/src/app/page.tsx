"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  fetchHealth,
  fetchRealPayloads,
  processMandate,
  runBenchmark,
  fetchSensitivitySweep,
  fetchAdversarialBenchmark,
  fetchIndependentAudit,
  fetchRegulatoryMatrix,
  fetchMessagingPreview,
  createRazorpayTestOrder,
  fetchAuditLogs,
  verifyAuditChain,
  resolveEscalatedMandate,
  getAuditExportUrl,
  fetchTaxonomy,
  RealErrorPayloadItem,
  ProcessResponse,
  BenchmarkResponse,
  SensitivitySweepResponse,
  IndependentAuditResponse,
  RegulatoryMatrixResponse,
  MessagingPreviewResponse,
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
import { RegulatoryMatrixModal } from "./components/RegulatoryMatrixModal";
import { MessagingPreviewModal } from "./components/MessagingPreviewModal";
import { CounterfactualInspector } from "./components/CounterfactualInspector";
import { DualBaselineBenchmarkCard } from "./components/DualBaselineBenchmarkCard";
import { SensitivitySweepInspector } from "./components/SensitivitySweepInspector";
import { AdversarialStressCard } from "./components/AdversarialStressCard";

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
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"live" | "benchmark_inspector" | "compliance" | "ops">("live");
  const [benchmarkSubTab, setBenchmarkSubTab] = useState<"benchmark" | "sensitivity" | "adversarial" | "inspector">("benchmark");
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

  // Benchmark & Evaluation state
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
  const [sensitivitySweepData, setSensitivitySweepData] = useState<SensitivitySweepResponse | null>(null);
  const [isSensitivityRunning, setIsSensitivityRunning] = useState<boolean>(false);
  const [adversarialData, setAdversarialData] = useState<BenchmarkResponse | null>(null);
  const [isAdversarialRunning, setIsAdversarialRunning] = useState<boolean>(false);

  // Modals state
  const [isRegulatoryModalOpen, setIsRegulatoryModalOpen] = useState<boolean>(false);
  const [regulatoryMatrixData, setRegulatoryMatrixData] = useState<RegulatoryMatrixResponse | null>(null);
  const [isMessagingModalOpen, setIsMessagingModalOpen] = useState<boolean>(false);
  const [messagingData, setMessagingData] = useState<MessagingPreviewResponse | null>(null);

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

  // Instant Non-blocking initial data load
  useEffect(() => {
    fetchHealth().then(setBackendHealth).catch(() => setBackendHealth({ status: "offline" }));
    fetchRealPayloads().then((payloads) => {
      if (payloads && payloads.length > 0) {
        setRealPayloads(payloads);
      }
    }).catch(() => {});
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

  const handleOpenMessagingPreview = async () => {
    if (!currentPayload) return;
    try {
      const res = await fetchMessagingPreview({
        customer_id: currentPayload.customer_id,
        mandate_id: currentPayload.mandate_id,
        amount_inr: currentPayload.amount / 100,
        decline_reason: currentPayload.error_reason,
      });
      setMessagingData(res);
      setIsMessagingModalOpen(true);
    } catch (e: any) {
      alert("Messaging preview error: " + e.message);
    }
  };

  const handleOpenRegulatoryMatrix = async () => {
    if (!regulatoryMatrixData) {
      try {
        const res = await fetchRegulatoryMatrix();
        setRegulatoryMatrixData(res);
      } catch (e: any) {
        alert("Failed to load regulatory matrix: " + e.message);
      }
    }
    setIsRegulatoryModalOpen(true);
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

  const handleRunSensitivitySweep = async () => {
    setIsSensitivityRunning(true);
    try {
      const res = await fetchSensitivitySweep(250, 42);
      setSensitivitySweepData(res);
    } catch (e: any) {
      alert("Sensitivity sweep error: " + e.message);
    } finally {
      setIsSensitivityRunning(false);
    }
  };

  const handleRunAdversarialStress = async () => {
    setIsAdversarialRunning(true);
    try {
      const res = await fetchAdversarialBenchmark(250, 999);
      setAdversarialData(res);
    } catch (e: any) {
      alert("Adversarial benchmark error: " + e.message);
    } finally {
      setIsAdversarialRunning(false);
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

  // Lazy tab data loading
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
                  v1.4.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                Deterministic Regulatory Gates • Agentic Action Planner • Zero-Trust Verifier
              </p>
            </div>
          </div>

          {/* Unified Compact Status Ribbon & Regulatory Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenRegulatoryMatrix}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 hover:bg-blue-900/60 text-xs font-semibold transition-all shadow-inner"
            >
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Regulatory Matrix</span>
            </button>

            <div className="hidden lg:flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono text-slate-300 shadow-inner flex-shrink-0">
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
                <span className="text-slate-300">FastAPI</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Clean Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-800/60 justify-start sm:justify-center">
          <div className="grid grid-cols-4 w-full sm:w-auto sm:flex sm:space-x-2">
            {[
              { id: "live", label: "Live Sequencer", icon: Zap },
              { id: "benchmark_inspector", label: "Benchmark & Rigor", icon: TrendingUp },
              { id: "compliance", label: "Compliance & Ledger", icon: Database },
              { id: "ops", label: "Ops Queue", icon: UserCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => startTransition(() => setActiveTab(tab.id as any))}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* ================= TAB 1: LIVE SEQUENCER ================= */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Description */}
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-900/40 border border-blue-900/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span>Real-Time Mandate Recovery Sequencer</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Select a live Razorpay decline signature or trigger dynamic Groq classification.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleOpenMessagingPreview}
                  className="px-3.5 py-2 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Hinglish & P2P Preview</span>
                </button>
                <button
                  onClick={handleRunSequencer}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>{isProcessing ? "Executing Sequencer..." : "Run Sequencer FSM"}</span>
                </button>
              </div>
            </div>

            {/* Error Payload Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {realPayloads.map((item) => {
                const isSelected = selectedPayloadId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPayload(item.id)}
                    className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/30 shadow-lg"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-400">₹{(item.payload.amount / 100).toLocaleString()}</span>
                        <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {item.category_expected}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-white line-clamp-2">{item.name}</div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 line-clamp-2">{item.description}</p>
                  </button>
                );
              })}
            </div>

            {/* 2-Column Execution View: Active Payload & Decision State */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Ingested Webhook Payload */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span>Ingested Error Payload</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(currentPayload, null, 2))}
                      className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-96 border border-slate-800/80 custom-scrollbar">
                    {JSON.stringify(currentPayload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Right Column: Execution Diagnosis, Decision & Counterfactuals */}
              <div className="lg:col-span-7 space-y-4">
                {processResult ? (
                  <div className="space-y-4">
                    {/* Stage Card: Diagnosis & Policy Decision */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <h3 className="font-bold text-white text-sm">Sequencing Decision Output</h3>
                        </div>
                        <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                          {processResult.decision.action}
                        </span>
                      </div>

                      {/* Rationale & EV breakdown */}
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1">
                          <span className="text-slate-400 font-semibold">Policy Rationale:</span>
                          <p className="text-slate-200 font-sans leading-relaxed">
                            {processResult.decision.rationale}
                          </p>
                        </div>

                        {processResult.decision.ev_calculation_breakdown && (
                          <div className="p-3 bg-blue-950/20 rounded-lg border border-blue-800/30 text-[11px] font-mono text-cyan-300">
                            {processResult.decision.ev_calculation_breakdown}
                          </div>
                        )}

                        {processResult.decision.afa_warning && (
                          <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span>{processResult.decision.afa_warning}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Counterfactual Decision Inspector */}
                    <CounterfactualInspector
                      selectedAction={processResult.decision.action}
                      counterfactuals={processResult.decision.counterfactuals}
                      whyChosen={processResult.decision.why_chosen}
                      policyClause={processResult.decision.policy_clause}
                    />

                    {/* Razorpay Test Order Trigger */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white">Razorpay Test-Mode SDK Dispatch</div>
                        <p className="text-[11px] text-slate-400">Trigger idempotent order create in test environment</p>
                      </div>
                      <button
                        onClick={handleCreateTestOrder}
                        disabled={isCreatingTestOrder}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1.5"
                      >
                        {isCreatingTestOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                        <span>{isCreatingTestOrder ? "Calling SDK..." : "Dispatch Test Order"}</span>
                      </button>
                    </div>

                    {testOrderResult && (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                        <span className="text-xs font-mono text-emerald-400 font-bold">SDK Response:</span>
                        <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto custom-scrollbar">
                          {JSON.stringify(testOrderResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-xl p-12 text-center space-y-3">
                    <Cpu className="w-10 h-10 text-slate-600 mx-auto" />
                    <h3 className="font-bold text-slate-300 text-sm">Sequencer Ready</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click &quot;Run Sequencer FSM&quot; to execute the multi-stage diagnosis and scarce-resource allocation pipeline.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: BENCHMARK & EVALUATION RIGOR ================= */}
        {activeTab === "benchmark_inspector" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Sub-Tabs */}
            <div className="flex border-b border-slate-800 space-x-4">
              {[
                { id: "benchmark", label: "Dual-Baseline & Oracle Benchmark" },
                { id: "sensitivity", label: "Prior Sensitivity Sweep (±30%)" },
                { id: "adversarial", label: "Adversarial Stress Test (#999)" },
                { id: "inspector", label: "Custom JSON Inspector" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setBenchmarkSubTab(sub.id as any)}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                    benchmarkSubTab === sub.id
                      ? "border-blue-500 text-blue-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: Dual Baselines + Oracle Benchmark */}
            {benchmarkSubTab === "benchmark" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-5">
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Comparative Recovery Benchmark Across 250 Held-Out Mandates
                    </h3>
                    <p className="text-xs text-slate-400">
                      Evaluates Sequencer against Naive Calendar Retries, Razorpay Documented Default Smart Retry, and Omniscient Oracle.
                    </p>
                  </div>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all disabled:opacity-50 self-start sm:self-auto"
                  >
                    {isBenchmarking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    <span>{isBenchmarking ? "Running Benchmark..." : "Run 250-Mandate Benchmark"}</span>
                  </button>
                </div>

                {benchmarkData ? (
                  <DualBaselineBenchmarkCard benchmark={benchmarkData} />
                ) : (
                  <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-xl p-12 text-center space-y-3">
                    <BarChart3 className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">Click &quot;Run 250-Mandate Benchmark&quot; to execute the evaluation.</p>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 2: Prior Sensitivity Sweep */}
            {benchmarkSubTab === "sensitivity" && (
              <SensitivitySweepInspector
                sweepData={sensitivitySweepData}
                isLoading={isSensitivityRunning}
                onRefresh={handleRunSensitivitySweep}
              />
            )}

            {/* Sub-Tab 3: Adversarial Stress Test */}
            {benchmarkSubTab === "adversarial" && (
              <AdversarialStressCard
                data={adversarialData}
                isLoading={isAdversarialRunning}
                onRun={handleRunAdversarialStress}
              />
            )}

            {/* Sub-Tab 4: Custom JSON Inspector */}
            {benchmarkSubTab === "inspector" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h4 className="font-bold text-white text-sm">Custom Failure JSON Input</h4>
                  <textarea
                    value={customJsonInput}
                    onChange={(e) => setCustomJsonInput(e.target.value)}
                    rows={12}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleRunCustomInspector}
                    disabled={isCustomProcessing}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all"
                  >
                    {isCustomProcessing ? "Processing..." : "Process Custom Payload"}
                  </button>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h4 className="font-bold text-white text-sm">Inspector Output</h4>
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 max-h-96 overflow-auto custom-scrollbar">
                    {customJsonResult ? JSON.stringify(customJsonResult, null, 2) : "// Run custom payload to see output"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: COMPLIANCE & LEDGER ================= */}
        {activeTab === "compliance" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Sub-Tabs */}
            <div className="flex border-b border-slate-800 space-x-4">
              {[
                { id: "independent_audit", label: "Zero-Trust Verifier" },
                { id: "ledger", label: "SHA-256 Merkle Ledger" },
                { id: "taxonomy", label: "Taxonomy & Priors Table" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setComplianceSubTab(sub.id as any)}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                    complianceSubTab === sub.id
                      ? "border-blue-500 text-blue-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Zero-Trust Verifier */}
            {complianceSubTab === "independent_audit" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-5">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span>Zero-Trust Independent Compliance Verifier</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Decoupled cryptographic auditor that re-derives attempt counts, 24h notice window deltas, and SHA-256 Merkle integrity.
                    </p>
                  </div>
                  <button
                    onClick={handleRunIndependentAudit}
                    disabled={isAuditing}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20"
                  >
                    {isAuditing ? "Auditing..." : "Re-run Zero-Trust Audit"}
                  </button>
                </div>

                {independentAudit?.assertions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(independentAudit.assertions)
                      .filter(([_, item]: any) => item && typeof item === "object" && "passed" in item)
                      .map(([key, item]: any) => (
                      <div key={key} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase">{key.replace(/_/g, " ")}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            item.passed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}>
                            {item.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {item.passed ? "100% verified against statutory policy bounds." : `${item.violations?.length || 0} violations flagged.`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SHA-256 Merkle Ledger */}
            {complianceSubTab === "ledger" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div>
                    <h4 className="font-bold text-white text-sm">Cryptographic Audit Ledger</h4>
                    <p className="text-xs text-slate-400">Immutable SHA-256 forward-linked block history</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleVerifyAuditChain}
                      disabled={isVerifyingChain}
                      className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-lg"
                    >
                      {isVerifyingChain ? "Verifying..." : "Verify Hash Chain"}
                    </button>
                    <a
                      href={getAuditExportUrl("csv")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </a>
                  </div>
                </div>

                {chainVerification && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{chainVerification.message} ({chainVerification.total_blocks} blocks verified)</span>
                  </div>
                )}

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Timestamp (UTC)</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Mandate ID</th>
                        <th className="px-4 py-3">Row Hash (SHA-256)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30 text-slate-300">
                          <td className="px-4 py-2.5">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "-"}</td>
                          <td className="px-4 py-2.5">
                            <span className="bg-slate-800 text-cyan-300 px-2 py-0.5 rounded text-[10px]">{log.stage}</span>
                          </td>
                          <td className="px-4 py-2.5">{log.mandate_failure_id}</td>
                          <td className="px-4 py-2.5 text-slate-500 truncate max-w-xs">{log.row_hash || "genesis"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Taxonomy */}
            {complianceSubTab === "taxonomy" && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="font-bold text-white text-sm">Official Razorpay Error Code Taxonomy (50+ Patterns)</h4>
                  <input
                    type="text"
                    placeholder="Search error code or reason..."
                    value={taxonomySearch}
                    onChange={(e) => setTaxonomySearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 w-64"
                  />
                </div>

                {taxonomyData && (
                  <div className="overflow-x-auto max-h-96 custom-scrollbar">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Error Signature</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Prior Recoverability</th>
                          <th className="px-3 py-2">Default Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {Object.entries(taxonomyData.taxonomy)
                          .filter(([key]) => key.toLowerCase().includes(taxonomySearch.toLowerCase()))
                          .map(([key, val]: any) => (
                            <tr key={key} className="hover:bg-slate-800/30 text-slate-300">
                              <td className="px-3 py-2 font-bold text-white">{key}</td>
                              <td className="px-3 py-2 text-cyan-300">{val.category}</td>
                              <td className="px-3 py-2 text-emerald-400">{(val.recoverability * 100).toFixed(0)}%</td>
                              <td className="px-3 py-2 text-slate-300">{val.default_action}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: OPS QUEUE ================= */}
        {activeTab === "ops" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                <span>Merchant Operations Triage & Resolution Queue</span>
              </h3>
              <p className="text-xs text-slate-400">
                Resolve escalated or hard-stopped mandates with cryptographic audit ledger hash-chaining.
              </p>

              {opsSuccessMsg && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs">
                  {opsSuccessMsg}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-slate-300">Resolution Notes:</label>
                <textarea
                  value={opsNotes}
                  onChange={(e) => setOpsNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleOpsResolve("mf_real_001")}
                  disabled={resolvingId !== null}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50"
                >
                  {resolvingId ? "Resolving..." : "Mark Mandate Resolved (Cryptographic Audit Commit)"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Primary Source Regulatory Matrix Modal */}
      <RegulatoryMatrixModal
        isOpen={isRegulatoryModalOpen}
        onClose={() => setIsRegulatoryModalOpen(false)}
        data={regulatoryMatrixData}
      />

      {/* Multilingual Messaging Preview Modal */}
      <MessagingPreviewModal
        isOpen={isMessagingModalOpen}
        onClose={() => setIsMessagingModalOpen(false)}
        data={messagingData}
      />
    </div>
  );
}
