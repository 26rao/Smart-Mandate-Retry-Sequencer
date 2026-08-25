"use client";

import React from "react";
import { Sliders, CheckCircle2, XCircle, Info, Sparkles } from "lucide-react";

interface CounterfactualItem {
  action: string;
  estimated_ev_inr: number;
  utility_score: number;
  rejection_reason: string;
}

interface Props {
  selectedAction: string;
  counterfactuals?: CounterfactualItem[];
  whyChosen?: string;
  policyClause?: string;
}

export const CounterfactualInspector: React.FC<Props> = ({
  selectedAction,
  counterfactuals,
  whyChosen,
  policyClause,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">
            Agentic Scarce-Resource Action Allocator
          </h4>
        </div>
        <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-full">
          Explainability Ledger
        </span>
      </div>

      {/* Why Winner Was Chosen */}
      {whyChosen && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Optimal Action Chosen: [{selectedAction}]</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{whyChosen}</p>
          {policyClause && (
            <div className="text-[10px] font-mono text-slate-400 pt-1">
              <span className="text-emerald-400 font-semibold">Statutory Clause: </span>
              {policyClause}
            </div>
          )}
        </div>
      )}

      {/* Alternative Counterfactuals Considered & Why Rejected */}
      {counterfactuals && counterfactuals.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span>Alternative Actions Considered & Why Rejected:</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {counterfactuals.map((cf, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
              >
                <div className="flex items-start space-x-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-slate-200">
                      {cf.action}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {cf.rejection_reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[10px] font-mono flex-shrink-0 self-end sm:self-center">
                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    Est. EV: ₹{cf.estimated_ev_inr.toFixed(2)}
                  </span>
                  <span className="bg-rose-950/40 text-rose-300 border border-rose-800/40 px-2 py-0.5 rounded">
                    Utility: {(cf.utility_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
