import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultMind — AI DeFi Keeper on Hedera",
  description:
    "AI agent that autonomously manages your Bonzo Finance vault positions. Sentiment-aware, volatility-responsive, with immutable HCS audit trail.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}