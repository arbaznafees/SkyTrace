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
  AlertTriangle,
  Layers,
  FileCheck,
  Radio,
  UserCheck,
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
  const [utcClock, setUtcClock] = useState("14:22:00 UTC");
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
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased flex flex-col justify-between">
      {/* Top Bar Banner */}
      <header className="w-full bg-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              SkyTrace Portal
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-medium">
            National Disaster Weather Intelligence Platform
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock size={13} className="text-slate-400" />
            <span className="tabular-nums">{utcClock}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700">
            <Satellite size={13} className="text-blue-600" />
            <span>INSAT-3D Online</span>
          </div>
        </div>
      </header>

      {/* Main Hero Viewport */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center my-auto space-y-6">
        {/* Live Severe Incident Flash Alert */}
        {severeAlert && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                Active Alert
              </span>
              <span className="text-xs font-bold text-rose-900">
                [{severeAlert.event_code}] {severeAlert.headline}
              </span>
              <span className="text-xs text-rose-700">
                • {severeAlert.district}, {severeAlert.state}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-rose-800 font-medium">
              <span>
                Trust: <strong>{Math.round(severeAlert.trust_score * 100)}%</strong>
              </span>
              <span>
                Corroboration: <strong>{severeAlert.report_count} reports</strong>
              </span>
            </div>
          </div>
        )}

        {/* 2-Column Split: Briefing & Sign-in */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Platform Overview & Live Metrics */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  ST
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Government of India
                  </h2>
                  <div className="text-xs text-slate-500 font-medium">
                    National Disaster Management Authority (NDMA) & IMD
                  </div>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                Disaster Meteorological Intelligence & Verification
              </h1>

              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Continuous ingestion of crowdsourced citizen observations, automated weather stations (AWS), and INSAT-3D Doppler radar streams. Corroborated in real time to power rapid emergency triage and civil defense warnings.
              </p>
            </div>

            {/* Live Operational Metrics Trio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Reports Ingested
                </div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {stats ? stats.total_raw_reports_merged : 628}
                </div>
                <div className="text-[11px] text-slate-500">
                  Total raw incident reports
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Noise Suppression
                </div>
                <div className="text-2xl font-bold text-blue-700 tabular-nums">
                  {stats ? `${stats.noise_floor_suppression_pct.toFixed(1)}%` : "78.4%"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Deduplication precision
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Verification Rate
                </div>
                <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                  {stats ? `${stats.verification_rate_pct.toFixed(1)}%` : "89.0%"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Sensor-fusion confidence
                </div>
              </div>
            </div>

            {/* Citizen Action Callout */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-blue-950">
                  Public Citizen Observer Portal
                </div>
                <div className="text-xs text-blue-800">
                  Are you experiencing severe local weather? No sign-in required to submit field ground observations.
                </div>
              </div>
              <Link
                href="/citizen-report"
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs"
              >
                Submit Report →
              </Link>
            </div>
          </div>

          {/* Right Column: Authorized Officer Sign-In */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wide">
                  <ShieldCheck size={16} />
                  <span>Authorized Personnel Access</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Duty Officer Sign In
                </h3>
                <p className="text-xs text-slate-500">
                  Enter credentials to access the operational GIS canvas and human review queue.
                </p>
              </div>

              {/* Demo Role Fill Helpers */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">
                    Fill Demo Credentials
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                    Active: {authRole === "admin" ? "NDMA Admin" : authRole === "eoc" ? "State EOC" : "IMD Analyst"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="btn-role-analyst"
                    onClick={() => handleRoleSelect("analyst")}
                    className={`py-2 px-2 text-center text-xs rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      authRole === "analyst"
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>IMD Analyst</span>
                    <span className={`text-[10px] ${authRole === "analyst" ? "text-blue-100" : "text-slate-400"}`}>
                      Analyst Level
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-role-admin"
                    onClick={() => handleRoleSelect("admin")}
                    className={`py-2 px-2 text-center text-xs rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      authRole === "admin"
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>NDMA Admin</span>
                    <span className={`text-[10px] ${authRole === "admin" ? "text-blue-100" : "text-slate-400"}`}>
                      HQ Commander
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-role-eoc"
                    onClick={() => handleRoleSelect("eoc")}
                    className={`py-2 px-2 text-center text-xs rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      authRole === "eoc"
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>State EOC</span>
                    <span className={`text-[10px] ${authRole === "eoc" ? "text-blue-100" : "text-slate-400"}`}>
                      Duty Officer
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-email" className="text-xs font-semibold text-slate-700">
                      Official Email
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {authRole === "admin" ? "NDMA HQ" : authRole === "eoc" ? "Odisha SEOC" : "IMD Central"}
                    </span>
                  </div>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      id="input-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="analyst@imd.gov.in"
                      autoComplete="username"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-password" className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      id="input-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-9 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <span>{loading ? "Authenticating..." : "Sign In to Operations"}</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Secure JWT Authentication</span>
                <Link href="/chat" className="text-blue-700 hover:underline">
                  Public Assistant →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            National Disaster Management Authority (NDMA) • India Meteorological Department (IMD)
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:text-blue-700">Operations</Link>
            <Link href="/citizen-report" className="hover:text-blue-700">Report Incident</Link>
            <Link href="/chat" className="hover:text-blue-700">Copilot</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
