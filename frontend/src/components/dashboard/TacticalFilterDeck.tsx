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
    <aside className="w-full xl:w-72 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-y-auto shadow-2xs">
      <div className="p-4 space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Filter Incidents
            </div>
            <div className="text-[11px] text-slate-500">
              Narrow active disaster stream
            </div>
          </div>
          <SlidersHorizontal size={16} className="text-blue-600" />
        </div>

        {/* Temporal Window Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Time Window
          </label>
          <div className="grid grid-cols-4 gap-1">
            {(["1h", "6h", "24h", "all"] as const).map((tw) => (
              <button
                key={tw}
                onClick={() => onFilterChange({ ...filters, timeWindow: tw })}
                className={`py-1 text-center text-xs font-medium rounded-md transition-colors border ${
                  filters.timeWindow === tw
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tw === "all" ? "All" : tw.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Status Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Verification Status
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => onFilterChange({ ...filters, statusFilter: "all" })}
              className={`px-2.5 py-1.5 text-left rounded-md border font-medium transition-colors ${
                filters.statusFilter === "all"
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => onFilterChange({ ...filters, statusFilter: "verified" })}
              className={`px-2.5 py-1.5 text-left rounded-md border font-medium transition-colors ${
                filters.statusFilter === "verified"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Verified Only
            </button>
            <button
              onClick={() =>
                onFilterChange({ ...filters, statusFilter: "pending_triage" })
              }
              className={`px-2.5 py-1.5 text-left rounded-md border font-medium transition-colors ${
                filters.statusFilter === "pending_triage"
                  ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Under Review
            </button>
            <button
              onClick={() =>
                onFilterChange({ ...filters, statusFilter: "rejected" })
              }
              className={`px-2.5 py-1.5 text-left rounded-md border font-medium transition-colors ${
                filters.statusFilter === "rejected"
                  ? "bg-rose-50 text-rose-800 border-rose-300 font-semibold"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Geographic Sector Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            State / Geographic Sector
          </label>
          <select
            value={filters.sector}
            onChange={(e) =>
              onFilterChange({ ...filters, sector: e.target.value })
            }
            className="w-full bg-slate-50 border border-slate-300 rounded-md text-slate-800 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Atmospheric Class Checklist */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
            <span>Hazard Categories</span>
            <span className="text-[11px] font-normal text-slate-500">
              ({filters.selectedCategories.length}/7 active)
            </span>
          </div>
          <div className="space-y-1 pt-1">
            {CATEGORIES.map((cat) => {
              const isChecked = filters.selectedCategories.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded text-xs text-slate-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* AI Trust Gate Slider */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 font-semibold">
            <span>Minimum Trust Score</span>
            <span className="text-blue-700 font-bold tabular-nums">
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
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>20% (All)</span>
            <span>50% (Review)</span>
            <span>80% (High Confidence)</span>
          </div>
        </div>
      </div>

      {/* Reset Filter Action */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={onReset}
          className="w-full py-2 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <RotateCcw size={13} />
          <span>Reset All Filters</span>
        </button>
      </div>
    </aside>
  );
};
