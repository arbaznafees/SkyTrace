import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "SkyTrace | National Weather Intelligence & Verification Platform",
  description: "Operational disaster meteorological verification, deduplication, and triage platform for NDMA & IMD.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
