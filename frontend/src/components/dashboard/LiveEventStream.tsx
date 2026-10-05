"use client";

import React, { useState } from "react";
import { GisEventItem } from "./GisRadarCanvas";
import { VerificationBadge } from "../common/VerificationBadge";
import { Search, MapPin, Users, X } from "lucide-react";

interface LiveEventStreamProps {
  events: GisEventItem[];
  selectedEvent: GisEventItem | null;
  onSelectEvent: (event: GisEventItem) => void;
}

export const LiveEventStream: React.FC<LiveEventStreamProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "urgency">("recent");

  const filtered = events
    .filter((e) => {
      const match =
        e.headline.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.event_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.primary_category.toLowerCase().includes(searchTerm.toLowerCase());
      return match;
    })
    .sort((a, b) => {
      if (sortOrder === "urgency") {
        const scoreA = (a.severity === "severe" ? 1 : 0) + (1 - a.trust_score);
        const scoreB = (b.severity === "severe" ? 1 : 0) + (1 - b.trust_score);
        return scoreB - scoreA;
      }
      return 0; // default recent order
    });

  return (
    <aside className="w-full xl:w-80 bg-slate-50 border-l border-slate-300 flex flex-col h-full shrink-0 shadow-2xs">
      {/* Stream Header */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Live Incident Stream
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 tabular-nums">
            {filtered.length} Events
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search district, event ID, hazard..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded pl-7 pr-6 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort triggers */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] font-mono text-slate-500 uppercase">Sort:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSortOrder("recent")}
              className={`px-2 py-0.5 text-[11px] rounded border font-mono transition-colors ${
                sortOrder === "recent"
                  ? "bg-slate-900 text-white border-slate-900 font-bold"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortOrder("urgency")}
              className={`px-2 py-0.5 text-[11px] rounded border font-mono transition-colors ${
                sortOrder === "urgency"
                  ? "bg-rose-700 text-white border-rose-800 font-bold"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Threat Level
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Event Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded border border-slate-200">
            No incidents matching current criteria.
          </div>
        ) : (
          filtered.map((evt) => {
            const isSelected = selectedEvent?.id === evt.id;

            let edgeClass = "border-l-3 border-l-emerald-600";
            if (evt.verification_status === "pending_triage" || evt.verification_status === "pending") {
              edgeClass = "border-l-3 border-l-amber-500";
            } else if (
              evt.verification_status === "rejected" ||
              evt.severity === "severe"
            ) {
              edgeClass = "border-l-3 border-l-rose-600";
            }

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`p-2.5 bg-white hover:bg-slate-50 rounded cursor-pointer transition-all border border-slate-200 shadow-2xs ${edgeClass} ${
                  isSelected ? "ring-2 ring-blue-600 bg-blue-50/30" : ""
                }`}
              >
                {/* Meta row: Badge & Code */}
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <VerificationBadge
                    status={evt.verification_status}
                    trustScore={evt.trust_score}
                    size="sm"
                  />
                  <span className="font-mono text-[11px] font-bold text-slate-600">
                    {evt.event_code}
                  </span>
                </div>

                {/* Headline */}
                <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 mb-1">
                  {evt.headline}
                </h4>

                {/* Summary preview */}
                <p className="text-[11px] text-slate-600 line-clamp-2 mb-1.5 leading-relaxed">
                  {evt.summary}
                </p>

                {/* Footer telemetry */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 font-medium text-slate-700 truncate mr-2">
                    <MapPin size={10} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {evt.district}, {evt.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-0.5 font-mono font-medium text-blue-800 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 text-[10px]">
                      <Users size={9} />
                      {evt.report_count}
                    </span>
                    <span
                      className={`px-1 py-0.2 uppercase rounded font-mono font-bold text-[9px] ${
                        evt.severity === "severe"
                          ? "bg-rose-100 text-rose-900 border border-rose-300"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {evt.severity}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Feed Status Footer */}
      <div className="p-2 border-t border-slate-200 bg-white flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Auto-Sync 30s</span>
        <span className="text-emerald-700 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping"></span>
          Ingestion Active
        </span>
      </div>
    </aside>
  );
};
