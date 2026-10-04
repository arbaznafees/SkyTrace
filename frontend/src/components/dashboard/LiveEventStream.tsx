"use client";

import React, { useState } from "react";
import { GisEventItem } from "./GisRadarCanvas";
import { VerificationBadge } from "../common/VerificationBadge";
import { Search, ArrowUpDown, MapPin, Users, X } from "lucide-react";

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
    <aside className="w-full xl:w-96 bg-slate-50 border-l border-slate-200 flex flex-col h-full shrink-0 shadow-2xs">
      {/* Stream Header */}
      <div className="p-3.5 border-b border-slate-200 bg-white space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Live Incident Stream
            </span>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 tabular-nums">
            {filtered.length} Events
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-2.5 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search district, event ID, hazard..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort triggers */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">Sort Order:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSortOrder("recent")}
              className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                sortOrder === "recent"
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortOrder("urgency")}
              className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                sortOrder === "urgency"
                  ? "bg-rose-600 text-white border-rose-600 shadow-2xs font-semibold"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Threat Level
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Event Cards List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
            No incidents matching current criteria.
          </div>
        ) : (
          filtered.map((evt) => {
            const isSelected = selectedEvent?.id === evt.id;

            // 4px signature edge bar
            let edgeClass = "border-l-4 border-l-emerald-500";
            if (evt.verification_status === "pending_triage" || evt.verification_status === "pending") {
              edgeClass = "border-l-4 border-l-amber-500";
            } else if (
              evt.verification_status === "rejected" ||
              evt.severity === "severe"
            ) {
              edgeClass = "border-l-4 border-l-rose-500";
            }

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`p-3 bg-white hover:bg-slate-50/90 rounded-lg cursor-pointer transition-all border border-slate-200 shadow-xs ${edgeClass} ${
                  isSelected ? "ring-2 ring-blue-500 bg-blue-50/40" : ""
                }`}
              >
                {/* Meta row: Badge & Code */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <VerificationBadge
                    status={evt.verification_status}
                    trustScore={evt.trust_score}
                    size="sm"
                  />
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {evt.event_code}
                  </span>
                </div>

                {/* Headline */}
                <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 mb-1">
                  {evt.headline}
                </h4>

                {/* Summary preview */}
                <p className="text-[11px] text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                  {evt.summary}
                </p>

                {/* Footer telemetry */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1 font-medium text-slate-700 truncate mr-2">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {evt.district}, {evt.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded text-[10px]">
                      <Users size={10} />
                      {evt.report_count}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 uppercase rounded text-[10px] font-bold ${
                        evt.severity === "severe"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
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
      <div className="p-2.5 border-t border-slate-200 bg-white flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span>Automatic Feed Refresh</span>
        <span className="text-emerald-700 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
          Live Ingestion
        </span>
      </div>
    </aside>
  );
};
