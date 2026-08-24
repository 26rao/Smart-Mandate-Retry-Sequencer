import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Razorpay Smart Mandate Retry Sequencer",
  description: "AI-Powered, Deterministic Regulatory-Compliant Recurring Payment Recovery Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b1426] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
