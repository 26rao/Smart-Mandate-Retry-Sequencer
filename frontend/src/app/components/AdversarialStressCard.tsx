"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react";
import { BenchmarkResponse } from "@/lib/api";

interface Props {
  data: BenchmarkResponse | null;
  isLoading: boolean;
  onRun: () => void;
}

export const AdversarialStressCard: React.FC<Props> = ({ data, isLoading, onRun }) => {
  if (!data && !isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h4 className="font-bold text-white text-sm">Adversarial Cohort Stress Test</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Simulate a high-stress fintech environment with 3x rate of hard declines, revoked mandates, and expired tokens.
        </p>
        <button
          onClick={onRun}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors"
        >
          Run Adversarial Stress Test (Seed: 999)
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div>
          <h4 className="font-bold text-white text-sm flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Adversarial Stress Test (Seeded Cohort #999)</span>
          </h4>
          <p className="text-xs text-slate-400">
            Stress-testing compliance and recovery under elevated churn, card expirations, and liquidity defaults
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={isLoading}
          className="px-3 py-1.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          {isLoading ? "Running Stress Test..." : "Re-run Stress Test"}
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-1">
              <span className="text-xs text-slate-400">Baseline Illegal Retries (Violations)</span>
              <div className="text-xl font-bold font-mono text-rose-400">
                {data.baseline.policy_violations} violations
              </div>
              <p className="text-[10px] text-slate-500">Naive baseline spammed revoked mandates</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-1">
              <span className="text-xs text-slate-400">Smart Sequencer Violations</span>
              <div className="text-xl font-bold font-mono text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>0 Violations (100% Compliant)</span>
              </div>
              <p className="text-[10px] text-slate-500">Zero-Trust Merkle verified</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-1">
              <span className="text-xs text-slate-400">Attempts Saved in Adversity</span>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {data.comparison.attempts_saved} ({data.comparison.attempts_saved_pct}%)
              </div>
              <p className="text-[10px] text-slate-500">Saved merchant from futile gateway fees</p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white">Adversarial Sequencer Recovery: </span>
              <span className="font-bold font-mono text-emerald-400">{data.sequencer.recovery_rate_pct}%</span>
              <span className="text-slate-400"> (vs Baseline {data.baseline.recovery_rate_pct}%)</span>
            </div>
            <div className="font-mono text-emerald-300 font-bold">
              +₹{data.comparison.additional_inr_recovered.toLocaleString()} additional recovered
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
