"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Activity, CheckSquare, Radio, Satellite } from "lucide-react";

interface TacticalRailProps {
  pendingReviewCount?: number;
}

export const TacticalRail: React.FC<TacticalRailProps> = ({
  pendingReviewCount = 37,
}) => {
  const pathname = usePathname();

  const railItems = [
    { label: "GIS Hazard Map", href: "/dashboard", icon: Map },
    { label: "Live Telemetry Feed", href: "/dashboard", icon: Activity },
    {
      label: "Triage & Review",
      href: "/admin/review-queue",
      icon: CheckSquare,
      count: pendingReviewCount,
    },
    { label: "Broadcast Alerts", href: "/admin/review-queue", icon: Radio },
  ];

  return (
    <aside className="hidden xl:flex fixed left-0 top-[84px] bottom-0 w-60 bg-slate-900 border-r border-slate-800 z-40 flex-col justify-between p-3 text-slate-300 shadow-sm">
      <div className="space-y-4">
        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest px-2.5 pt-1">
          Tactical Operations
        </div>

        <nav className="space-y-1">
          {railItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors border ${
                  isActive
                    ? "bg-slate-800 text-white border-slate-700 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={15}
                    className={isActive ? "text-blue-400" : "text-slate-500"}
                  />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded tabular-nums ${
                      isActive
                        ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                        : "bg-slate-800 text-amber-400 border border-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Atmospheric Link Telemetry Card */}
      <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Satellite size={13} className="text-blue-400" />
          <span className="text-[11px] font-mono uppercase tracking-wide">INSAT-3D Link</span>
        </div>
        <div className="text-[11px] text-slate-400 space-y-1 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Status:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Synchronized
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Grid:</span>
            <span className="text-slate-300">East Coast</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Doppler:</span>
            <span className="text-slate-300">Paradip DWR</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
