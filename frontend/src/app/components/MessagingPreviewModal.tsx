"use client";

import React, { useState } from "react";
import { MessageSquare, Smartphone, Mail, X, Check, Copy } from "lucide-react";
import { MessagingPreviewResponse } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: MessagingPreviewResponse | null;
}

export const MessagingPreviewModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  const [lang, setLang] = useState<"hinglish" | "english">("hinglish");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0e172a] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-white truncate">
                Customer Recovery Notification & P2P
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Compliant multichannel messaging (Hinglish / English)
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

        {/* Language & Channel Selectors */}
        <div className="p-3.5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800">
            {/* Channel Tabs */}
            <div className="flex overflow-x-auto no-scrollbar bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-medium w-full sm:w-auto">
              <button
                onClick={() => setChannel("whatsapp")}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                  channel === "whatsapp" ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setChannel("sms")}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                  channel === "sms" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>
              <button
                onClick={() => setChannel("email")}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                  channel === "email" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            </div>

            {/* Language Switch */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
              <button
                onClick={() => setLang("hinglish")}
                className={`px-3 py-1.5 rounded-lg transition-all flex-1 sm:flex-initial text-center ${
                  lang === "hinglish" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Hinglish
              </button>
              <button
                onClick={() => setLang("english")}
                className={`px-3 py-1.5 rounded-lg transition-all flex-1 sm:flex-initial text-center ${
                  lang === "english" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Preview Box */}
          {channel === "whatsapp" && (
            <div className="bg-[#054640]/20 border border-[#00a884]/30 rounded-xl p-4 space-y-3 relative">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>WhatsApp Business API Template (Razorpay Verified)</span>
                </span>
                <button
                  onClick={() => copyText(data.channels.whatsapp[lang])}
                  className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs bg-slate-800/80 px-2.5 py-1 rounded-md"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>

              <div className="bg-[#0b141a] border border-[#222e35] p-4 rounded-lg text-sm text-slate-100 whitespace-pre-wrap font-sans leading-relaxed">
                {data.channels.whatsapp[lang]}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {data.channels.whatsapp.interactive_buttons.map((btn, bIdx) => (
                  <span
                    key={bIdx}
                    className="text-xs bg-[#1f2c34] hover:bg-[#2a3942] border border-[#2a3942] text-cyan-300 font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  >
                    {btn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {channel === "sms" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
                <span>TRAI DLT Registered SMS Header (RZRPAY)</span>
                <button
                  onClick={() => copyText(data.channels.sms[lang])}
                  className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs bg-slate-800/80 px-2.5 py-1 rounded-md"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg text-sm text-slate-200 font-mono leading-relaxed border border-slate-800">
                {data.channels.sms[lang]}
              </div>
            </div>
          )}

          {channel === "email" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs text-purple-400 font-semibold">
                <span>Subject: {data.channels.email[lang].subject}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg text-sm text-slate-200 font-sans leading-relaxed border border-slate-800">
                {data.channels.email[lang].body_preview}
              </div>
            </div>
          )}

          {/* Promise-to-Pay (P2P) Flow Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Interactive Promise-to-Pay (P2P) Options Preview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.promise_to_pay.options.map((opt) => (
                <div
                  key={opt.option_id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 hover:border-blue-500/50 transition-all cursor-pointer"
                >
                  <div className="text-xs font-semibold text-white">
                    {lang === "hinglish" ? opt.label_hi : opt.label_en}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Action ID: {opt.option_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
