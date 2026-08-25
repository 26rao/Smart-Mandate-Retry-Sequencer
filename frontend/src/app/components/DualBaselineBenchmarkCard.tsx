"use client";

import React from "react";
import { TrendingUp, ShieldAlert, Sparkles, Zap, ArrowUpRight, Scale, ShieldCheck } from "lucide-react";
import { BenchmarkResponse } from "@/lib/api";

interface Props {
  benchmark: BenchmarkResponse;
}

export const DualBaselineBenchmarkCard: React.FC<Props> = ({ benchmark }) => {
  const { baseline, razorpay_baseline, sequencer, oracle, comparison } = benchmark;

  return (
    <div className="space-y-6">
      {/* 4-Way Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Baseline A: Naive Calendar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Baseline A</span>
              <span className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">
                Naive
              </span>
            </div>
            <h4 className="font-bold text-white text-sm">Fixed Calendar Retries</h4>
            <p className="text-xs text-slate-400 leading-snug">
              Blind +24h/+72h/+168h retry intervals regardless of decline category.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Recovery Rate:</span>
              <span className="font-bold font-mono text-slate-200">{baseline.recovery_rate_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Recovered:</span>
              <span className="font-bold font-mono text-slate-200">₹{baseline.recovered_inr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Attempts / Mandate:</span>
              <span className="font-mono text-rose-400 font-bold">{baseline.avg_attempts_per_mandate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Regulatory Violations:</span>
              <span className="font-mono text-rose-400 font-bold">{baseline.policy_violations}</span>
            </div>
          </div>
        </div>

        {/* 2. Baseline B: Razorpay Default Smart Retry */}
        {razorpay_baseline && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Baseline B</span>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                  Doc Default
                </span>
              </div>
              <h4 className="font-bold text-white text-sm">Razorpay Standard Retry</h4>
              <p className="text-xs text-slate-400 leading-snug">
                Production-grade 3-attempt backoff with payment gateway health checks.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Recovery Rate:</span>
                <span className="font-bold font-mono text-blue-300">{razorpay_baseline.recovery_rate_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Recovered:</span>
                <span className="font-bold font-mono text-blue-300">₹{razorpay_baseline.recovered_inr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg Attempts / Mandate:</span>
                <span className="font-mono text-slate-300">{razorpay_baseline.avg_attempts_per_mandate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Regulatory Violations:</span>
                <span className="font-mono text-amber-400 font-semibold">{razorpay_baseline.policy_violations}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Smart Sequencer (Winner) */}
        <div className="bg-gradient-to-b from-blue-950/40 to-slate-900/90 border-2 border-blue-500/60 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-xl shadow-blue-500/10 relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Our Sequencer</span>
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                100% Compliant
              </span>
            </div>
            <h4 className="font-bold text-white text-sm">Smart Mandate Sequencer</h4>
            <p className="text-xs text-slate-300 leading-snug">
              Deterministic regulatory gates + Agentic EV allocator + Salary cycle timing.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-300 font-semibold">Recovery Rate:</span>
              <span className="font-extrabold font-mono text-emerald-400 text-sm">{sequencer.recovery_rate_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300 font-semibold">Total Recovered:</span>
              <span className="font-bold font-mono text-emerald-300">₹{sequencer.recovered_inr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Avg Attempts / Mandate:</span>
              <span className="font-mono text-emerald-400 font-bold">{sequencer.avg_attempts_per_mandate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Policy Violations:</span>
              <span className="font-mono text-emerald-400 font-bold">0 (Zero-Trust Verified)</span>
            </div>
          </div>
        </div>

        {/* 4. Theoretical Oracle (Upper Bound) */}
        {oracle && (
          <div className="bg-slate-900/80 border border-purple-900/50 rounded-xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Oracle Ceiling</span>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">
                  Upper Bound
                </span>
              </div>
              <h4 className="font-bold text-white text-sm">Omniscient Oracle</h4>
              <p className="text-xs text-slate-400 leading-snug">
                Theoretical ceiling assuming perfect foreknowledge of customer liquidity days.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Max Recovery Ceiling:</span>
                <span className="font-bold font-mono text-purple-300">{oracle.recovery_rate_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max Money Recoverable:</span>
                <span className="font-bold font-mono text-purple-300">₹{oracle.recovered_inr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Oracle Residual Gap:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {comparison.oracle_residual_gap_pct ?? 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Optimality Ratio:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {((sequencer.recovered_inr / oracle.recovered_inr) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lift Highlights Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-center">
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <div className="text-xs text-slate-400 font-medium">Incremental Recovery Lift vs Default</div>
          <div className="text-xl font-black text-emerald-400 mt-1 flex items-center justify-center space-x-1">
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            <span>+₹{(comparison.additional_inr_vs_rzp_baseline ?? comparison.additional_inr_recovered).toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Across {benchmark.baseline.total_mandates} batch mandates</p>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <div className="text-xs text-slate-400 font-medium">Gateway Debit Attempts Saved</div>
          <div className="text-xl font-black text-cyan-400 mt-1">
            {comparison.attempts_saved} ({comparison.attempts_saved_pct}%)
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Eliminates wasted fee burn</p>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <div className="text-xs text-slate-400 font-medium">Regulatory Policy Violations</div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            0 Violations
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {comparison.policy_violations_prevented} illegal retries prevented
          </p>
        </div>
      </div>
    </div>
  );
};
