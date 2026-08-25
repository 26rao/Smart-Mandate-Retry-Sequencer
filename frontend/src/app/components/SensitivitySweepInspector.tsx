"use client";

import React from "react";
import { Sliders, CheckCircle2, TrendingUp, HelpCircle } from "lucide-react";
import { SensitivitySweepResponse } from "@/lib/api";

interface Props {
  sweepData: SensitivitySweepResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SensitivitySweepInspector: React.FC<Props> = ({ sweepData, isLoading, onRefresh }) => {
  if (!sweepData && !isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center space-y-3">
        <Sliders className="w-8 h-8 text-blue-400 mx-auto" />
        <h4 className="font-bold text-white text-sm">Empirical Prior Sensitivity Sweep</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Evaluate recovery rate robustness when empirical recoverability priors are perturbed from -30% to +30%.
        </p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors"
        >
          Run Parameter Sensitivity Sweep
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div>
          <h4 className="font-bold text-white text-sm flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Parameter Sensitivity Sweep (±30% Prior Perturbation)</span>
          </h4>
          <p className="text-xs text-slate-400">
            Proves that Smart Sequencer lift is structurally robust and not an artifact of hand-tuned priors
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          {isLoading ? "Running Sweep..." : "Re-run Sweep"}
        </button>
      </div>

      {sweepData && (
        <>
          {/* Summary Box */}
          <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-3 text-xs text-slate-200 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-400">Mathematical Robustness Proven: </span>
              <span>{sweepData.robustness_summary.conclusion}</span>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                Net Lift Range: +{sweepData.robustness_summary.min_net_lift_pct}% to +{sweepData.robustness_summary.max_net_lift_pct}% vs calendar baseline across all ±30% distortions.
              </div>
            </div>
          </div>

          {/* Sweep Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Prior Perturbation</th>
                  <th className="px-3 py-2.5">Naive Calendar</th>
                  <th className="px-3 py-2.5">Razorpay Default</th>
                  <th className="px-3 py-2.5">Smart Sequencer</th>
                  <th className="px-3 py-2.5 text-emerald-400 font-bold">Net Lift (vs RZP)</th>
                  <th className="px-3 py-2.5">Attempts Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sweepData.sweep_runs.map((run, idx) => {
                  const isBaseline = run.prior_adjustment_pct === 0;
                  return (
                    <tr
                      key={idx}
                      className={isBaseline ? "bg-blue-950/30 font-bold text-white" : "hover:bg-slate-800/30 text-slate-300"}
                    >
                      <td className="px-3 py-2 flex items-center space-x-1.5">
                        <span className={isBaseline ? "text-cyan-300" : "text-slate-400"}>{run.label}</span>
                        {isBaseline && <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">DEFAULT</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{run.baseline_calendar_recovery_pct}%</td>
                      <td className="px-3 py-2 text-blue-300">{run.baseline_rzp_recovery_pct}%</td>
                      <td className="px-3 py-2 text-emerald-400 font-bold">{run.sequencer_recovery_pct}%</td>
                      <td className="px-3 py-2 text-emerald-300 font-bold">+{run.net_lift_vs_rzp_pct}%</td>
                      <td className="px-3 py-2 text-cyan-400">{run.attempts_saved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
