"use client";

import React from "react";
import { Clock, AlertTriangle, Radio, RotateCw, Activity } from "lucide-react";

interface TopBarStatsProps {
  totalEvents?: number;
  pendingCount?: number;
  severeCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TopBarStatsTicker: React.FC<TopBarStatsProps> = ({
  totalEvents,
  pendingCount,
  severeCount,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <section className="w-full bg-white px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 shadow-2xs">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
        {/* Events Today */}
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-blue-600 shrink-0" />
          <span className="text-slate-600 font-medium">Events Ingested:</span>
          <span className="font-mono font-bold text-slate-900 tabular-nums min-w-[20px] flex items-center">
            {totalEvents !== undefined ? (
              totalEvents
            ) : (
              <span className="inline-block w-6 h-3.5 bg-slate-200 animate-pulse rounded" />
            )}
          </span>
        </div>

        <div className="w-px h-3.5 bg-slate-300 hidden sm:block"></div>

        {/* Pending Review */}
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-amber-600 shrink-0" />
          <span className="text-slate-600 font-medium">Pending Review:</span>
          <span className="font-mono font-bold text-amber-800 tabular-nums min-w-[18px] flex items-center">
            {pendingCount !== undefined ? (
              pendingCount
            ) : (
              <span className="inline-block w-5 h-3.5 bg-amber-100 animate-pulse rounded" />
            )}
          </span>
          <span className="px-1.5 py-0.2 bg-amber-50 text-amber-900 border border-amber-300 rounded font-mono text-[10px] font-bold uppercase">
            Action Needed
          </span>
        </div>

        <div className="w-px h-3.5 bg-slate-300 hidden sm:block"></div>

        {/* Active Severe */}
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-rose-600 shrink-0" />
          <span className="text-slate-600 font-medium">Critical Alerts:</span>
          <span className="font-mono font-bold text-rose-800 tabular-nums min-w-[18px] flex items-center">
            {severeCount !== undefined ? (
              severeCount
            ) : (
              <span className="inline-block w-5 h-3.5 bg-rose-100 animate-pulse rounded" />
            )}
          </span>
        </div>
      </div>

      {/* Real Ingestion Feeds Status & Manual Refresh Button */}
      <div className="flex items-center gap-3 text-xs">
        <div className="hidden md:flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
          <Radio size={12} className="text-emerald-600" />
          <span>IMD Doppler Stream Live</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
            title="Fetch latest ground truth and Doppler events"
          >
            <RotateCw
              size={12}
              className={isRefreshing ? "animate-spin text-blue-600" : "text-slate-600"}
            />
            <span>Refresh Feed</span>
          </button>
        )}
      </div>
    </section>
  );
};
