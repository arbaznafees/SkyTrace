"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FilePlus,
  MessageSquare,
  LogIn,
  LogOut,
  Clock,
  Radio,
  AlertTriangle,
  Layers,
  Lock,
} from "lucide-react";
import { HeaderStats, fetchHeaderStats } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TacticalHeaderProps {
  stats?: HeaderStats | null;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  stats,
}) => {
  const pathname = usePathname();
  const [utcTime, setUtcTime] = useState<string>("14:22:00 UTC");
  const [internalStats, setInternalStats] = useState<HeaderStats | null>(null);
  const { user, logout, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (stats === undefined) {
      fetchHeaderStats().then((data) => {
        if (data) setInternalStats(data);
      });
    }
  }, [stats]);

  const effectiveStats = stats !== undefined ? stats : internalStats;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "OP";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return { label: "NDMA Admin", bg: "bg-rose-50 text-rose-800 border-rose-300" };
      case "analyst":
        return { label: "IMD Analyst", bg: "bg-blue-50 text-blue-800 border-blue-300" };
      case "eoc":
        return { label: "State EOC", bg: "bg-amber-50 text-amber-800 border-amber-300" };
      default:
        return { label: "Duty Officer", bg: "bg-slate-100 text-slate-800 border-slate-300" };
    }
  };

  const navLinks = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
      label: "Review Queue",
      href: "/admin/review-queue",
      icon: CheckSquare,
      badge: effectiveStats?.pendingCount,
      adminOnly: true,
    },
    { label: "Citizen Report", href: "/citizen-report", icon: FilePlus },
    { label: "Assistant Chat", href: "/chat", icon: MessageSquare },
    ...(!isAuthenticated ? [{ label: "Sign In", href: "/login", icon: LogIn }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-300 shadow-xs">
      {/* Tier 1: Main Platform Identification & Operational Summary */}
      <div className="h-12 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 text-white">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-blue-600 border border-blue-400 flex items-center justify-center text-white font-mono font-bold text-xs shadow-xs">
              ST
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-white font-mono">
                  SkyTrace
                </span>
                <span className="hidden sm:inline text-slate-500 text-[10px]">|</span>
                <span className="hidden sm:inline text-[11px] text-slate-300 font-medium">
                  National Disaster Weather Intelligence & Verification
                </span>
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded text-slate-300 text-[11px] border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-[10px] tracking-wide uppercase">Operational</span>
          </div>
        </div>

        {/* Live Event Stats & Operational Time / User Profile */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-xs bg-slate-800/90 px-2.5 py-1 rounded border border-slate-700">
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <Layers size={12} className="text-blue-400" />
              <span>Active:</span>
              <span className="font-mono font-bold text-white tabular-nums">
                {effectiveStats ? effectiveStats.totalEvents : "--"}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <Clock size={12} className="text-amber-400" />
              <span>Pending:</span>
              <span className="font-mono font-bold text-amber-300 tabular-nums">
                {effectiveStats ? effectiveStats.pendingCount : "--"}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <AlertTriangle size={12} className="text-rose-400" />
              <span>Severe:</span>
              <span className="font-mono font-bold text-rose-300 tabular-nums">
                {effectiveStats ? effectiveStats.severeCount : "--"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-300 font-mono">
              <Clock size={12} className="text-slate-400" />
              <span className="tabular-nums">{utcTime}</span>
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-[11px] font-semibold text-slate-200 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded border ${
                        getRoleBadge(user.role).bg
                      }`}
                    >
                      {getRoleBadge(user.role).label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {user.station_id}
                    </span>
                  </div>
                </div>

                <div
                  title={`${user.full_name} (${user.role})`}
                  className="w-7 h-7 rounded bg-slate-700 text-white border border-slate-600 flex items-center justify-center text-[11px] font-mono font-bold"
                >
                  {getInitials(user.full_name)}
                </div>

                <button
                  onClick={logout}
                  title="Sign Out of Session"
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <LogIn size={12} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2: Sub-Navigation Bar */}
      <div className="h-9 px-4 sm:px-6 bg-slate-100 border-t border-slate-200 flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center gap-1 h-full">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap border ${
                  isActive
                    ? "bg-white text-blue-900 border-slate-300 shadow-2xs font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                }`}
              >
                <Icon size={13} className={isActive ? "text-blue-700" : "text-slate-500"} />
                <span>{link.label}</span>
                {link.adminOnly && !isAdmin && (
                  <span className="flex items-center text-[9px] text-slate-500 bg-slate-200 px-1 rounded font-mono" title="Admin access required">
                    <Lock size={9} className="mr-0.5" />
                    Admin
                  </span>
                )}
                {link.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded tabular-nums ${
                      isActive
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
          <Radio size={11} className="text-emerald-600" />
          <span>IMD & INSAT-3D Doppler Stream Online</span>
        </div>
      </div>
    </header>
  );
};
