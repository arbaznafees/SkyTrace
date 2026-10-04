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
    // If stats are not passed from parent, fetch live telemetry stats on mount
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
        return { label: "NDMA Admin", bg: "bg-rose-50 text-rose-700 border-rose-200" };
      case "analyst":
        return { label: "IMD Analyst", bg: "bg-blue-50 text-blue-700 border-blue-200" };
      case "eoc":
        return { label: "State EOC", bg: "bg-amber-50 text-amber-700 border-amber-200" };
      default:
        return { label: "Duty Officer", bg: "bg-slate-100 text-slate-700 border-slate-200" };
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      {/* Tier 1: Main Platform Identification & Operational Summary */}
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-blue-700 transition-colors">
              ST
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                SkyTrace
              </div>
              <div className="text-[11px] text-slate-500 font-medium tracking-normal mt-0.5">
                National Weather Intelligence & Verification
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 text-xs font-medium border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Monitoring Active</span>
          </div>
        </div>

        {/* Live Event Stats & Operational Time / User Profile */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Layers size={13} className="text-blue-600" />
              <span>Active Events:</span>
              <span className="font-semibold text-slate-900 tabular-nums min-w-[20px] flex items-center">
                {effectiveStats ? (
                  effectiveStats.totalEvents
                ) : (
                  <span className="inline-block w-6 h-3.5 bg-slate-200 animate-pulse rounded" />
                )}
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock size={13} className="text-amber-500" />
              <span>Pending Review:</span>
              <span className="font-semibold text-amber-700 tabular-nums min-w-[18px] flex items-center">
                {effectiveStats ? (
                  effectiveStats.pendingCount
                ) : (
                  <span className="inline-block w-5 h-3.5 bg-amber-100 animate-pulse rounded" />
                )}
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <AlertTriangle size={13} className="text-rose-500" />
              <span>Severe Alerts:</span>
              <span className="font-semibold text-rose-700 tabular-nums min-w-[18px] flex items-center">
                {effectiveStats ? (
                  effectiveStats.severeCount
                ) : (
                  <span className="inline-block w-5 h-3.5 bg-rose-100 animate-pulse rounded" />
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Clock size={14} className="text-slate-400" />
              <span className="tabular-nums">{utcTime}</span>
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                        getRoleBadge(user.role).bg
                      }`}
                    >
                      {getRoleBadge(user.role).label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {user.station_id}
                    </span>
                  </div>
                </div>

                <div
                  title={`${user.full_name} (${user.role})`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-2xs border ${
                    user.role === "admin"
                      ? "bg-rose-100 text-rose-700 border-rose-300"
                      : user.role === "eoc"
                      ? "bg-amber-100 text-amber-700 border-amber-300"
                      : "bg-blue-100 text-blue-700 border-blue-300"
                  }`}
                >
                  {getInitials(user.full_name)}
                </div>

                <button
                  onClick={logout}
                  title="Sign Out of Session"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2: Sub-Navigation Bar */}
      <div className="h-10 px-4 sm:px-6 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center gap-1 h-full">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon size={13} />
                <span>{link.label}</span>
                {link.adminOnly && !isAdmin && (
                  <span className="flex items-center text-[10px] text-slate-400 bg-slate-200/80 px-1 rounded ml-0.5" title="Admin access required">
                    <Lock size={10} className="mr-0.5" />
                    Admin
                  </span>
                )}
                {link.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full tabular-nums ${
                      isActive
                        ? "bg-white text-blue-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <Radio size={12} className="text-emerald-500" />
          <span>IMD & INSAT-3D Doppler Stream Online</span>
        </div>
      </div>
    </header>
  );
};
