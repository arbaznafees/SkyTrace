"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Clock,
  Satellite,
  Radio,
  FileText,
  Users,
  CheckCircle2,
} from "lucide-react";

interface OperationalStats {
  total_active_events: number;
  total_raw_reports_merged: number;
  noise_floor_suppression_pct: number;
  verification_rate_pct: number;
  response_velocity_seconds: number;
  triage_sample_size: number;
}

interface SevereEvent {
  event_code: string;
  headline: string;
  primary_category: string;
  severity: string;
  trust_score: number;
  report_count: number;
  latitude: number;
  longitude: number;
  location_name: string;
  district: string;
  state: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("analyst@imd.gov.in");
  const [password, setPassword] = useState("SkyTrace@2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [authRole, setAuthRole] = useState<"analyst" | "admin" | "eoc">("analyst");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [utcClock, setUtcClock] = useState("11:12:08 UTC");
  const [stats, setStats] = useState<OperationalStats | null>(null);
  const [severeAlert, setSevereAlert] = useState<SevereEvent | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcClock(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/events/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch((err) => console.warn("Live telemetry stats fetch failed:", err));

    fetch(`${API_BASE}/api/v1/events?severity=severe&status=verified&limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSevereAlert(data[0]);
        }
      })
      .catch((err) => console.warn("Live severe incident fetch failed:", err));
  }, []);

  const handleRoleSelect = (role: "analyst" | "admin" | "eoc") => {
    setAuthRole(role);
    if (role === "analyst") {
      setEmail("analyst@imd.gov.in");
      setPassword("SkyTrace@2026!");
    } else if (role === "admin") {
      setEmail("admin@ndma.gov.in");
      setPassword("SkyTrace@2026!");
    } else {
      setEmail("eoc.duty@odisha.gov.in");
      setPassword("SkyTrace@2026!");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        login(data, data.access_token);
        if (data.role === "admin") {
          router.push("/admin/review-queue");
        } else {
          router.push("/dashboard");
        }
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || "Authentication failed. Please verify credentials.");
      }
    } catch {
      setErrorMessage("Network error: Unable to contact SkyTrace gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex flex-col justify-between overflow-x-hidden text-white font-sans antialiased selection:bg-blue-600 selection:text-white"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(7, 13, 26, 0.70) 0%, rgba(7, 13, 26, 0.35) 45%, rgba(7, 13, 26, 0.50) 100%), url('/images/login-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundColor: "#070d19",
      }}
    >
      {/* Top Operational Header */}
      <header className="w-full bg-slate-950/85 backdrop-blur-md text-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold tracking-wider uppercase text-white font-mono">
              SkyTrace Portal
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-300 font-medium">
            National Disaster Weather Intelligence Platform
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock size={12} className="text-slate-400" />
            <span className="tabular-nums">{utcClock}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-900/90 border border-slate-700/80 rounded font-mono text-[10px] text-emerald-400 font-medium">
            <Satellite size={11} className="text-emerald-400" />
            <span>INSAT-3D Online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex-1 flex flex-col justify-center z-10">
        {/* Live Severe Incident Flash Alert (if present) */}
        {severeAlert && (
          <div className="mb-6 bg-rose-950/85 backdrop-blur-md border border-rose-500/50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-rose-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                Active Alert
              </span>
              <span className="font-bold text-rose-200 font-mono">
                [{severeAlert.event_code}]
              </span>
              <span className="font-semibold text-white">
                {severeAlert.headline}
              </span>
              <span className="text-rose-200">
                • {severeAlert.district}, {severeAlert.state}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-rose-200 font-mono">
              <span>
                Trust: <strong>{Math.round(severeAlert.trust_score * 100)}%</strong>
              </span>
              <span>
                Corroboration: <strong>{severeAlert.report_count} reports</strong>
              </span>
            </div>
          </div>
        )}

        {/* 2-Column Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Brand Identity, Indicators, Operational Tagline */}
          <div className="lg:col-span-7 space-y-7 text-left">
            {/* Logo & Headline */}
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg border border-blue-400/40 text-white">
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                    <circle cx="12" cy="13" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none">
                    SkyTrace
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide mt-1">
                    National Weather Intelligence & Verification
                  </p>
                </div>
              </div>
              <div className="w-12 h-1 bg-blue-500 rounded-full"></div>
            </div>

            {/* Operational Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Indicator 1: INSAT-3D */}
              <div className="flex items-center gap-3 p-3 bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/60 shadow-sm">
                <div className="p-2 bg-blue-950/80 rounded-lg text-blue-400 shrink-0">
                  <Satellite size={18} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">INSAT-3D Satellite</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Live | Synced</span>
                  </div>
                </div>
              </div>

              {/* Indicator 2: IMD Doppler */}
              <div className="flex items-center gap-3 p-3 bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/60 shadow-sm">
                <div className="p-2 bg-blue-950/80 rounded-lg text-blue-400 shrink-0">
                  <Radio size={18} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">IMD Doppler Radar</div>
                  <div className="text-xs font-bold text-blue-300 font-mono">
                    {stats ? `${stats.total_active_events} Active Cells` : "Operational Grid"}
                  </div>
                </div>
              </div>

              {/* Indicator 3: Real-Time Reports */}
              <div className="flex items-center gap-3 p-3 bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/60 shadow-sm">
                <div className="p-2 bg-blue-950/80 rounded-lg text-blue-400 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Citizen Reports</div>
                  <div className="text-xs font-bold text-blue-300 font-mono">
                    {stats ? `${stats.total_raw_reports_merged} Ingested` : "Real-time Stream"}
                  </div>
                </div>
              </div>
            </div>

            {/* Static Operational Statement / Tagline */}
            <div className="pt-2">
              <p className="text-2xl sm:text-3xl font-medium tracking-tight text-white leading-snug max-w-lg drop-shadow-md">
                “Turning real-time observations into faster, safer decisions.”
              </p>
            </div>

            {/* Government / Institutional Attribution */}
            <div className="pt-2 border-t border-slate-700/60 flex items-center gap-3 text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
                <ShieldCheck size={16} className="text-slate-300" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">
                  Government of India <span className="text-slate-500 font-normal">|</span> NDMA & IMD
                </div>
                <div className="text-[11px] text-slate-400">
                  People • Preparedness • Safer Communities
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authorized Officer Sign-in Card + Citizen Observer Action */}
          <div className="lg:col-span-5 flex flex-col space-y-3.5 max-w-md w-full mx-auto lg:ml-auto">
            {/* Primary Login Card */}
            <div className="bg-white text-slate-900 rounded-2xl border border-slate-200/90 shadow-2xl p-6 sm:p-7 space-y-5">
              {/* Card Header */}
              <div className="space-y-1 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase font-mono tracking-wider">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>Authorized Personnel Access</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Duty Officer Sign In
                </h2>
                <p className="text-xs text-slate-500">
                  Access the operational dashboard, GIS canvas and review queue.
                </p>
              </div>

              {/* Demo Role Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    Fill Demo Credentials
                  </label>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    Active: {authRole === "admin" ? "NDMA Admin" : authRole === "eoc" ? "State EOC" : "IMD Analyst"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="btn-role-analyst"
                    onClick={() => handleRoleSelect("analyst")}
                    className={`py-2 px-2 text-center text-xs rounded-lg transition-all flex flex-col items-center justify-center ${
                      authRole === "analyst"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>IMD Analyst</span>
                    <span className="text-[9px] opacity-80 font-mono">Analyst Level</span>
                  </button>

                  <button
                    type="button"
                    id="btn-role-admin"
                    onClick={() => handleRoleSelect("admin")}
                    className={`py-2 px-2 text-center text-xs rounded-lg transition-all flex flex-col items-center justify-center ${
                      authRole === "admin"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>NDMA Admin</span>
                    <span className="text-[9px] opacity-80 font-mono">HQ Commander</span>
                  </button>

                  <button
                    type="button"
                    id="btn-role-eoc"
                    onClick={() => handleRoleSelect("eoc")}
                    className={`py-2 px-2 text-center text-xs rounded-lg transition-all flex flex-col items-center justify-center ${
                      authRole === "eoc"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>State EOC</span>
                    <span className="text-[9px] opacity-80 font-mono">Duty Officer</span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-email" className="text-xs font-semibold text-slate-700">
                      Official Email
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {authRole === "admin" ? "NDMA HQ" : authRole === "eoc" ? "Odisha SEOC" : "IMD Central"}
                    </span>
                  </div>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      id="input-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="analyst@imd.gov.in"
                      autoComplete="username"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-password" className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      id="input-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 px-4 text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  <span>{loading ? "Authenticating..." : "Sign In to Operations"}</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium text-slate-400 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-blue-500" />
                  Secure JWT Authentication
                </span>
                <Link
                  href="/chat"
                  className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  <span>Public Assistant</span>
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* Public Citizen Observer Portal Card */}
            <div className="bg-white text-slate-900 rounded-xl border border-slate-200/90 shadow-md p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-tight">
                    Public Citizen Observer Portal
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Are you experiencing severe local weather? No sign-in required.
                  </div>
                </div>
              </div>
              <Link
                href="/citizen-report"
                className="px-3.5 py-1.5 bg-white border border-blue-600 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs flex items-center gap-1"
              >
                <span>Submit Report</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="w-full bg-slate-950/85 backdrop-blur-md border-t border-slate-800/80 py-3.5 px-4 sm:px-6 text-xs text-slate-400 z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            National Disaster Management Authority (NDMA) • India Meteorological Department (IMD)
          </div>
          <div className="flex items-center gap-5 text-slate-300">
            <Link href="/dashboard" className="hover:text-blue-400 font-medium transition-colors">
              Operations
            </Link>
            <Link href="/citizen-report" className="hover:text-blue-400 font-medium transition-colors">
              Report Incident
            </Link>
            <Link href="/chat" className="hover:text-blue-400 font-medium transition-colors">
              Copilot
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
