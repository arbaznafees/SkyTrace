"use client";

import React from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

export interface FilterState {
  timeWindow: "1h" | "6h" | "24h" | "all";
  sector: string;
  selectedCategories: string[];
  minTrust: number;
  statusFilter: "all" | "verified" | "pending_triage" | "rejected";
}

interface TacticalFilterDeckProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onReset: () => void;
}

const CATEGORIES = [
  { id: "flooding", label: "Flooding & Inundation" },
  { id: "thunderstorm", label: "Thunderstorm / Lightning" },
  { id: "rainfall", label: "Heavy Rainfall" },
  { id: "heatwave", label: "Heatwave / Loo" },
  { id: "fog", label: "Dense Fog" },
  { id: "dust_storm", label: "Dust Storm / Andhi" },
  { id: "strong_wind", label: "Strong Wind / Gale" },
];

const SECTORS = [
  "All India Sectors",
  "Odisha Coastal Sector",
  "West Bengal / Delta",
  "Jharkhand Mineral Belt",
  "Maharashtra / Mumbai",
  "Assam / Brahmaputra",
  "Delhi NCR Corridor",
  "Rajasthan / Thar",
  "Gujarat Coastal Zone",
];

export const TacticalFilterDeck: React.FC<TacticalFilterDeckProps> = ({
  filters,
  onFilterChange,
  onReset,
}) => {
  const toggleCategory = (catId: string) => {
    const exists = filters.selectedCategories.includes(catId);
    const updated = exists
      ? filters.selectedCategories.filter((c) => c !== catId)
      : [...filters.selectedCategories, catId];
    onFilterChange({ ...filters, selectedCategories: updated });
  };

  return (
    <aside className="w-full xl:w-64 bg-white border-r border-slate-300 flex flex-col justify-between shrink-0 overflow-y-auto text-slate-800 shadow-2xs">
      <div className="p-3.5 space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
              Filter Incidents
            </div>
            <div className="text-[10px] text-slate-500">
              Narrow active disaster stream
            </div>
          </div>
          <SlidersHorizontal size={14} className="text-slate-500" />
        </div>

        {/* Temporal Window Filter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
              Time Window
            </label>
            <span className="text-[9px] text-slate-400 font-mono">(Telemetry State)</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(["1h", "6h", "24h", "all"] as const).map((tw) => (
              <button
                key={tw}
                onClick={() => onFilterChange({ ...filters, timeWindow: tw })}
                className={`py-1 text-center font-mono text-[11px] font-semibold rounded border transition-colors ${
                  filters.timeWindow === tw
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {tw === "all" ? "All" : tw.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Status Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
            Verification Status
          </label>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              onClick={() => onFilterChange({ ...filters, statusFilter: "all" })}
              className={`px-2 py-1 text-left rounded border font-medium transition-colors ${
                filters.statusFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900 font-bold"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => onFilterChange({ ...filters, statusFilter: "verified" })}
              className={`px-2 py-1 text-left rounded border font-medium transition-colors ${
                filters.statusFilter === "verified"
                  ? "bg-emerald-700 text-white border-emerald-800 font-bold"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Verified Only
            </button>
            <button
              onClick={() =>
                onFilterChange({ ...filters, statusFilter: "pending_triage" })
              }
              className={`px-2 py-1 text-left rounded border font-medium transition-colors ${
                filters.statusFilter === "pending_triage"
                  ? "bg-amber-600 text-white border-amber-700 font-bold"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Under Review
            </button>
            <button
              onClick={() =>
                onFilterChange({ ...filters, statusFilter: "rejected" })
              }
              className={`px-2 py-1 text-left rounded border font-medium transition-colors ${
                filters.statusFilter === "rejected"
                  ? "bg-rose-700 text-white border-rose-800 font-bold"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Geographic Sector Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
            State / Geographic Sector
          </label>
          <select
            value={filters.sector}
            onChange={(e) =>
              onFilterChange({ ...filters, sector: e.target.value })
            }
            className="w-full bg-slate-50 border border-slate-300 rounded text-slate-800 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Atmospheric Class Checklist */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
            <span>Hazard Categories</span>
            <span className="text-[10px] font-mono text-slate-500 font-normal">
              {filters.selectedCategories.length}/7 active
            </span>
          </div>
          <div className="space-y-0.5 pt-0.5">
            {CATEGORIES.map((cat) => {
              const isChecked = filters.selectedCategories.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded text-xs text-slate-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* AI Trust Gate Slider */}
        <div className="space-y-1 pt-2 border-t border-slate-200">
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
            <span>Minimum Trust Score</span>
            <span className="font-mono text-blue-700 font-bold tabular-nums">
              ≥ {Math.round(filters.minTrust * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.20"
            max="0.95"
            step="0.05"
            value={filters.minTrust}
            onChange={(e) =>
              onFilterChange({ ...filters, minTrust: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>20% (All)</span>
            <span>50% (Review)</span>
            <span>80% (High Conf)</span>
          </div>
        </div>
      </div>

      {/* Reset Filter Action */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={onReset}
          className="w-full py-1.5 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <RotateCcw size={12} />
          <span>Reset All Filters</span>
        </button>
      </div>
    </aside>
  );
};
