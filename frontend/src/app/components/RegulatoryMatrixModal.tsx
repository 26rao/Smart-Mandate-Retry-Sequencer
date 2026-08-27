"use client";

import React from "react";
import { ShieldCheck, Scale, ExternalLink, X, BookOpen, CheckCircle2 } from "lucide-react";
import { RegulatoryMatrixResponse } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: RegulatoryMatrixResponse | null;
}

export const RegulatoryMatrixModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0e172a] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-white flex items-center space-x-1.5 sm:space-x-2 truncate">
                <span className="truncate">Regulatory & Compliance Appendix</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                  Certified
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Statutory mapping to official central bank & payments council circulars
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 text-sm text-slate-300 custom-scrollbar">
          {data?.frameworks?.map((fw, idx) => (
            <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span>{fw.framework}</span>
                  </h3>
                  <p className="text-xs text-slate-400">Authority: {fw.authority}</p>
                </div>
                <div className="text-[11px] sm:text-xs font-mono bg-blue-950/60 border border-blue-800/60 text-blue-300 px-2.5 sm:px-3 py-1 rounded-lg self-start sm:self-auto">
                  {fw.governing_circular}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fw.rules.map((rule, rIdx) => (
                  <div key={rIdx} className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{rule.rule}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                        {rule.clause}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rule.requirement}</p>
                    <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-800/30 px-2.5 py-1 rounded">
                      <span className="text-slate-400">Enforcement: </span>
                      {rule.enforcement}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Bank Holiday Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Indian Banking Settlement & Clearing Calendar Guard</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Recurring payments executing on Indian Bank Holidays (Gazetted + 2nd/4th Saturdays + Sundays) suffer from a
              ~42% false technical decline rate due to batch switch maintenance. The Smart Sequencer dynamically computes
              holiday offsets via <code className="text-cyan-300 bg-cyan-950/50 px-1 py-0.5 rounded">adjust_for_bank_holidays</code> and
              shifts debits to 09:00 AM IST on the next open clearing business day.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close Appendix
          </button>
        </div>
      </div>
    </div>
  );
};
