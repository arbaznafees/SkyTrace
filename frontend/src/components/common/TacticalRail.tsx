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
    <aside className="hidden xl:flex fixed left-0 top-24 bottom-0 w-64 bg-white border-r border-slate-200 z-40 flex-col justify-between p-4 shadow-xs">
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
          Operations Modules
        </div>

        <nav className="space-y-1">
          {railItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={16}
                    className={isActive ? "text-blue-600" : "text-slate-400"}
                  />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full tabular-nums ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-amber-100 text-amber-800"
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
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <Satellite size={14} className="text-blue-600" />
          <span>INSAT-3D Satellite Link</span>
        </div>
        <div className="text-[11px] text-slate-600 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Status:</span>
            <span className="text-emerald-700 font-medium">Synchronized</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Grid:</span>
            <span>East Coast / Odisha</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Doppler:</span>
            <span>Paradip DWR Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
