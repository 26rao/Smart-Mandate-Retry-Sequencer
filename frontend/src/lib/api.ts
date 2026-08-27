export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
};

const API_BASE = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

export interface RealErrorPayloadItem {
  id: string;
  name: string;
  category_expected: string;
  description: string;
  payload: {
    id: string;
    payment_id: string;
    mandate_id: string;
    amount: number;
    currency: string;
    error_code: string;
    error_reason: string;
    error_source: string;
    error_step: string;
    error_description: string;
    customer_id?: string;
    customer_persona?: string;
    payment_method?: string;
    attempt_number: number;
    salary_day_of_month?: number;
  };
}

export interface Diagnosis {
  category: string;
  recoverability: number;
  recommended_action: string;
  reason: string;
  confidence: number;
  suggested_delay_hours?: number;
  llm_model?: string;
  raw_reasoning?: string;
}

export interface Decision {
  mandate_failure_id: string;
  action: string;
  regulatory_framework?: string;
  payment_method?: string;
  schedule_at?: string;
  notice_sent_at?: string;
  earliest_retry_at?: string;
  is_non_peak_scheduled?: boolean;
  expected_value_inr?: number;
  attempt_cost_inr?: number;
  message_template?: string;
  rationale: string;
  remaining_attempts: number;
  confidence: number;
  is_safe: boolean;
  policy_clause?: string;
  ev_calculation_breakdown?: string;
  why_chosen?: string;
  counterfactuals?: Array<{
    action: string;
    estimated_ev_inr: number;
    utility_score: number;
    rejection_reason: string;
  }>;
  bank_holiday_delayed?: boolean;
  afa_warning?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  mandate_failure_id: string;
  stage: string;
  input_data: any;
  output_data: any;
  llm_used: boolean;
  llm_model?: string;
  notes?: string;
  prev_hash?: string;
  row_hash?: string;
}

export interface ProcessResponse {
  mandate_failure_id: string;
  diagnosis: Diagnosis;
  decision: Decision;
  execution_result: any;
  audit_trail: AuditEntry[];
  audit_trail_count: number;
  current_stage: string;
  is_finished: boolean;
}

export interface BenchmarkMetrics {
  strategy: string;
  total_mandates: number;
  total_at_risk_inr: number;
  recovered_inr: number;
  recovery_rate_pct: number;
  total_attempts_used: number;
  avg_attempts_per_mandate: number;
  policy_violations: number;
  compliance_pct: number;
  recovered_count: number;
  description?: string;
}

export interface BenchmarkResponse {
  baseline: BenchmarkMetrics;
  razorpay_baseline?: BenchmarkMetrics;
  sequencer: BenchmarkMetrics & {
    exceptions_count: number;
    ev_negative_halts_count?: number;
    ev_negative_halts_sample?: any[];
  };
  oracle?: BenchmarkMetrics;
  cohorts?: Record<string, {
    persona: string;
    total_count: number;
    total_at_risk_inr: number;
    recovered_inr: number;
    recovery_rate_pct: number;
    attempts_used: number;
  }>;
  comparison: {
    additional_inr_recovered: number;
    additional_inr_vs_rzp_baseline?: number;
    attempts_saved: number;
    attempts_saved_pct: number;
    policy_violations_prevented: number;
    compliance_score_gain: number;
    ev_negative_tradeoffs_halted?: number;
    oracle_residual_gap_inr?: number;
    oracle_residual_gap_pct?: number;
  };
}

export interface SweepRun {
  prior_adjustment_pct: number;
  label: string;
  baseline_calendar_recovery_pct: number;
  baseline_rzp_recovery_pct: number;
  sequencer_recovery_pct: number;
  net_lift_vs_calendar_pct: number;
  net_lift_vs_rzp_pct: number;
  attempts_saved: number;
}

export interface SensitivitySweepResponse {
  sample_size: number;
  seed: number;
  sweep_runs: SweepRun[];
  robustness_summary: {
    min_net_lift_pct: number;
    max_net_lift_pct: number;
    conclusion: string;
  };
}

export interface SensitivityResponse {
  tested_seeds: number[];
  runs: Array<{
    seed: number;
    sample_size: number;
    baseline_recovery_pct: number;
    razorpay_baseline_recovery_pct?: number;
    sequencer_recovery_pct: number;
    net_lift_pct: number;
    attempts_saved_pct: number;
    violations_prevented: number;
    additional_inr_recovered: number;
  }>;
  stability_summary: {
    median_recovery_lift_pct: number;
    min_recovery_lift_pct: number;
    max_recovery_lift_pct: number;
    median_attempts_saved_pct: number;
    min_attempts_saved_pct: number;
    max_attempts_saved_pct: number;
    conclusion: string;
  };
}

export interface IndependentAuditResponse {
  status: string;
  verifier: string;
  timestamp_utc: string;
  all_assertions_passed: boolean;
  total_blocks_checked: number;
  total_violations_found: number;
  score_pct: number;
  summary: string;
  assertions: {
    hash_chain_continuity: { passed: boolean; violations: any[] };
    npci_upi_attempt_cap: { passed: boolean; violations: any[] };
    rbi_card_attempt_cap: { passed: boolean; violations: any[] };
    statutory_24h_notice_window: { passed: boolean; violations: any[] };
    terminal_revocation_lock: { passed: boolean; violations: any[] };
  };
}

export interface RegulatoryMatrixResponse {
  frameworks: Array<{
    framework: string;
    authority: string;
    governing_circular: string;
    rules: Array<{
      rule: string;
      clause: string;
      requirement: string;
      enforcement: string;
    }>;
  }>;
}

export interface MessagingPreviewResponse {
  customer_id: string;
  amount_inr: number;
  channels: {
    whatsapp: {
      english: string;
      hinglish: string;
      interactive_buttons: string[];
    };
    sms: {
      english: string;
      hinglish: string;
    };
    email: {
      english: { subject: string; body_preview: string };
      hinglish: { subject: string; body_preview: string };
    };
  };
  promise_to_pay: {
    p2p_portal_url: string;
    options: Array<{ option_id: string; label_en: string; label_hi: string }>;
  };
}

// Timeout helper with AbortController for fast non-blocking calls
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function fetchHealth() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`, { cache: "no-store" }, 1500);
    if (!res.ok) throw new Error("Backend offline");
    return res.json();
  } catch {
    return { status: "ready_local", mode: "LIVE", llm_provider: "groq", groq_model: "gpt-oss-120b" };
  }
}

export async function fetchRealPayloads(): Promise<RealErrorPayloadItem[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/v1/payloads/real`, { cache: "no-store" }, 1500);
    if (!res.ok) throw new Error("Failed to load real error payloads");
    return res.json();
  } catch {
    return [];
  }
}

export async function processMandate(payload: any): Promise<ProcessResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Processing failed");
  }
  return res.json();
}

export async function runBenchmark(count: number = 250, seed: number = 42): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/benchmark?count=${count}&seed=${seed}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Benchmark execution failed");
  return res.json();
}

export async function fetchSensitivitySweep(count: number = 250, seed: number = 42): Promise<SensitivitySweepResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/sensitivity/sweep?count=${count}&seed=${seed}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Sensitivity sweep failed");
  return res.json();
}

export async function fetchAdversarialBenchmark(count: number = 250, seed: number = 999): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/adversarial?count=${count}&seed=${seed}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Adversarial benchmark failed");
  return res.json();
}

export async function fetchSensitivityAnalysis(seeds: string = "42,101,777"): Promise<SensitivityResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/sensitivity?seeds=${seeds}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Sensitivity analysis failed");
  return res.json();
}

export async function fetchIndependentAudit(limit: number = 250): Promise<IndependentAuditResponse> {
  const res = await fetch(`${API_BASE}/api/v1/compliance/independent-audit?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Independent audit failed");
  return res.json();
}

export async function fetchRegulatoryMatrix(): Promise<RegulatoryMatrixResponse> {
  const res = await fetch(`${API_BASE}/api/v1/compliance/regulatory-matrix`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load regulatory matrix");
  return res.json();
}

export async function fetchMessagingPreview(params?: {
  customer_id?: string;
  mandate_id?: string;
  amount_inr?: number;
  decline_reason?: string;
  scheduled_date?: string;
}): Promise<MessagingPreviewResponse> {
  const q = new URLSearchParams();
  if (params?.customer_id) q.set("customer_id", params.customer_id);
  if (params?.mandate_id) q.set("mandate_id", params.mandate_id);
  if (params?.amount_inr) q.set("amount_inr", params.amount_inr.toString());
  if (params?.decline_reason) q.set("decline_reason", params.decline_reason);
  if (params?.scheduled_date) q.set("scheduled_date", params.scheduled_date);

  const res = await fetch(`${API_BASE}/api/v1/messaging/preview?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load messaging preview");
  return res.json();
}

export async function createRazorpayTestOrder(amount: number, paymentId: string, mandateId: string) {
  const res = await fetch(`${API_BASE}/api/v1/razorpay/test-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, payment_id: paymentId, mandate_id: mandateId }),
  });
  if (!res.ok) throw new Error("Failed to create test order");
  return res.json();
}

export async function fetchAuditLogs(limit: number = 40): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE}/api/v1/audit/logs?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}

export async function verifyAuditChain() {
  const res = await fetch(`${API_BASE}/api/v1/audit/verify`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to verify audit chain");
  return res.json();
}

export async function resolveEscalatedMandate(
  mandateFailureId: string,
  resolutionNotes: string,
  operatorId: string = "ops_analyst_01"
) {
  const res = await fetch(`${API_BASE}/api/v1/ops/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mandate_failure_id: mandateFailureId,
      resolution_notes: resolutionNotes,
      operator_id: operatorId,
    }),
  });
  if (!res.ok) throw new Error("Failed to resolve mandate in Ops queue");
  return res.json();
}

export function getAuditExportUrl(format: string = "csv") {
  return `${API_BASE}/api/v1/audit/export?format=${format}`;
}

export async function fetchTaxonomy() {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/taxonomy`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load taxonomy");
  return res.json();
}
