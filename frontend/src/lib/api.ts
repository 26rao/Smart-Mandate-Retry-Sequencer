const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

export interface BenchmarkResponse {
  baseline: {
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
  };
  sequencer: {
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
    exceptions_count: number;
  };
  comparison: {
    additional_inr_recovered: number;
    attempts_saved: number;
    attempts_saved_pct: number;
    policy_violations_prevented: number;
    compliance_score_gain: number;
  };
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

export async function fetchRealPayloads(): Promise<RealErrorPayloadItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/payloads/real`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load real error payloads");
  return res.json();
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

export async function runBenchmark(count: number = 250): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sequencer/benchmark?count=${count}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Benchmark execution failed");
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
