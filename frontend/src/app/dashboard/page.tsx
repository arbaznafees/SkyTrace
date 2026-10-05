"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TacticalHeader } from "@/components/common/TacticalHeader";
import { TacticalRail } from "@/components/common/TacticalRail";
import { TopBarStatsTicker } from "@/components/dashboard/TopBarStatsTicker";
import {
  TacticalFilterDeck,
  FilterState,
} from "@/components/dashboard/TacticalFilterDeck";
import {
  GisRadarCanvas,
  GisEventItem,
} from "@/components/dashboard/GisRadarCanvas";
import { LiveEventStream } from "@/components/dashboard/LiveEventStream";
import { EventDetailDrawer } from "@/components/dashboard/EventDetailDrawer";
import { API_BASE, HeaderStats, fetchHeaderStats } from "@/lib/api";
import { SlidersHorizontal, Map, List, CheckSquare, X, Lock } from "lucide-react";

// Initial realistic fallback events across Indian regions per seed_data.py
const INITIAL_EVENTS: GisEventItem[] = [
  {
    id: "evt-9001",
    event_code: "EVT-9001",
    primary_category: "flooding",
    severity: "severe",
    headline: "Flash Flooding & Roadway Inundation - Puri Marine Drive",
    summary:
      "Water depth exceeding 1.5 feet covering arterial coastal road. Local sluice gates overflowing into low-lying settlements near Swargadwar beachfront.",
    latitude: 19.8135,
    longitude: 85.8312,
    location_name: "Puri Coastal Marine Drive",
    district: "Puri",
    state: "Odisha",
    report_count: 8,
    trust_score: 0.94,
    verification_status: "verified",
  },
  {
    id: "evt-9002",
    event_code: "EVT-9002",
    primary_category: "thunderstorm",
    severity: "severe",
    headline: "Severe Kalbaishakhi Supercell with Intense Lightning - Kolkata",
    summary:
      "Rapid convective mesocyclone formation with violent cloud-to-ground lightning clusters and squall winds recorded along EM Bypass corridor.",
    latitude: 22.5726,
    longitude: 88.3639,
    location_name: "EM Bypass / Salt Lake Sector V",
    district: "Kolkata",
    state: "West Bengal",
    report_count: 5,
    trust_score: 0.89,
    verification_status: "verified",
  },
  {
    id: "evt-9003",
    event_code: "EVT-9003",
    primary_category: "flooding",
    severity: "moderate",
    headline: "Urban Waterlogging in Milan Subway Underpass - Mumbai",
    summary:
      "Subway underpass submerged under 2 feet stormwater. Barricades deployed by Mumbai traffic police; vehicles diverted towards SV Road.",
    latitude: 19.076,
    longitude: 72.8777,
    location_name: "Mithi River / Milan Subway",
    district: "Mumbai Suburban",
    state: "Maharashtra",
    report_count: 4,
    trust_score: 0.76,
    verification_status: "pending_triage",
  },
  {
    id: "evt-9004",
    event_code: "EVT-9004",
    primary_category: "rainfall",
    severity: "severe",
    headline: "Torrential Cloudburst Surge (>65 mm/hr) - Guwahati",
    summary:
      "Automatic rain gauge recording torrential continuous precipitation in Bharalu river basin. Local stormwater channels running at full brim.",
    latitude: 26.1445,
    longitude: 91.7362,
    location_name: "Guwahati Bharalu Basin",
    district: "Kamrup Metropolitan",
    state: "Assam",
    report_count: 6,
    trust_score: 0.92,
    verification_status: "verified",
  },
  {
    id: "evt-9005",
    event_code: "EVT-9005",
    primary_category: "dust_storm",
    severity: "severe",
    headline: "Severe Andhi / High-Velocity Dust Squall - Bikaner",
    summary:
      "Dense wall of particulate dust advancing across desert highway. Highway visibility dropped instantaneously below 100 meters with 65 km/h gusts.",
    latitude: 28.0229,
    longitude: 73.3119,
    location_name: "Thar High Particulate Wall",
    district: "Bikaner",
    state: "Rajasthan",
    report_count: 3,
    trust_score: 0.68,
    verification_status: "pending_triage",
  },
  {
    id: "evt-9006",
    event_code: "EVT-9006",
    primary_category: "heatwave",
    severity: "severe",
    headline: "Severe Loo Wind Heat Surge (46.8°C) - Churu",
    summary:
      "Intense desiccating westerly winds pushing surface temperatures 5.4°C above normal. Heat index alert declared for rural agro-climatic zone.",
    latitude: 28.29,
    longitude: 74.96,
    location_name: "Shekhawati Heat Incline Core",
    district: "Churu",
    state: "Rajasthan",
    report_count: 2,
    trust_score: 0.85,
    verification_status: "verified",
  },
  {
    id: "evt-9007",
    event_code: "EVT-9007",
    primary_category: "strong_wind",
    severity: "severe",
    headline: "Gale-Force Coastal Wind Front (Squall 65kt) - Balasore",
    summary:
      "Deep cyclonic depression in Bay of Bengal generating sustained gale winds with downed utility lines along Chandipur interceptor belt.",
    latitude: 21.4934,
    longitude: 86.9135,
    location_name: "Chandipur Coastal Sector",
    district: "Balasore",
    state: "Odisha",
    report_count: 7,
    trust_score: 0.91,
    verification_status: "verified",
  },
];

export default function DashboardPage() {
  const [events, setEvents] = useState<GisEventItem[]>(INITIAL_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<GisEventItem | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"canvas" | "stream">("canvas");

  const [stats, setStats] = useState<HeaderStats | null>(null);
  const [accessAlert, setAccessAlert] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    timeWindow: "all",
    sector: "All India Sectors",
    selectedCategories: [
      "flooding",
      "thunderstorm",
      "rainfall",
      "heatwave",
      "fog",
      "dust_storm",
      "strong_wind",
    ],
    minTrust: 0.2,
    statusFilter: "all",
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEvents = async () => {
    setIsRefreshing(true);
    try {
      const [eventsRes, statsData] = await Promise.all([
        fetch(`${API_BASE}/api/v1/events?limit=150`),
        fetchHeaderStats(),
      ]);
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setEvents(data);
        }
      }
      if (statsData) {
        setStats(statsData);
      }
    } catch {
      // Fallback retained
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // Relaxed 30-second background polling interval to protect Supabase connection pool
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Deep-link query param support: /dashboard?event=EVT-9001
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("event");
      if (targetId && events.length > 0) {
        const match = events.find(
          (e) => e.event_code === targetId || e.id === targetId
        );
        if (match) setSelectedEvent(match);
      }
      if (params.get("alert") === "admin_clearance_required" || params.get("denied") === "admin_only") {
        setAccessAlert("Access to the Review Queue requires NDMA Administrative clearance. You have been redirected to the Operations Dashboard.");
        const timer = setTimeout(() => setAccessAlert(null), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [events]);

  const resetFilters = () => {
    setFilters({
      timeWindow: "all",
      sector: "All India Sectors",
      selectedCategories: [
        "flooding",
        "thunderstorm",
        "rainfall",
        "heatwave",
        "fog",
        "dust_storm",
        "strong_wind",
      ],
      minTrust: 0.2,
      statusFilter: "all",
    });
  };

  const handleTriageUpdate = (eventId: string, newStatus: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, verification_status: newStatus } : e
      )
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) =>
        prev ? { ...prev, verification_status: newStatus } : null
      );
    }
  };

  const displayedEvents = events.filter((evt) => {
    if (
      filters.statusFilter !== "all" &&
      evt.verification_status !== filters.statusFilter
    ) {
      return false;
    }
    if (evt.trust_score < filters.minTrust) {
      return false;
    }
    if (
      filters.selectedCategories.length > 0 &&
      !filters.selectedCategories.includes(evt.primary_category)
    ) {
      return false;
    }
    if (filters.sector !== "All India Sectors") {
      const sec = filters.sector.toLowerCase();
      const match =
        evt.state.toLowerCase().includes(sec.split(" ")[0]) ||
        evt.district.toLowerCase().includes(sec.split(" ")[0]);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900 font-sans">
      {/* Persistent Operations Header */}
      <TacticalHeader stats={stats} />

      {/* Access Clearance Warning Toast */}
      {accessAlert && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2.5 max-w-md border border-amber-500/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <Lock size={16} className="text-amber-400 shrink-0" />
          <span className="flex-1">{accessAlert}</span>
          <button
            onClick={() => setAccessAlert(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Fixed Left Navigation Rail (Desktop) */}
      <TacticalRail pendingReviewCount={stats?.pendingCount ?? 0} />

      {/* Main Operations Matrix Canvas */}
      <div className="pl-0 xl:pl-60 pt-[84px] pb-16 md:pb-0 flex-1 flex flex-col min-h-0">
        {/* Top-Bar Telemetry & Stream Metrics Ticker */}
        <TopBarStatsTicker
          totalEvents={stats?.totalEvents}
          pendingCount={stats?.pendingCount}
          severeCount={stats?.severeCount}
          onRefresh={fetchEvents}
          isRefreshing={isRefreshing}
        />

        {/* Responsive Sub-Header Control Strip (< 1280px Breakpoint) */}
        <div className="xl:hidden bg-white px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-3 z-20 shadow-2xs">
          {/* Off-Canvas Filter Drawer Trigger */}
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-md flex items-center gap-1.5 hover:bg-slate-200 transition-colors border border-slate-300"
          >
            <SlidersHorizontal size={14} className="text-blue-600" />
            <span>Filters</span>
          </button>

          {/* Segmented Control Toggle: MAP vs LIST */}
          <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setMobilePane("canvas")}
              className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                mobilePane === "canvas"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Map size={13} />
              <span>Map</span>
            </button>
            <button
              onClick={() => setMobilePane("stream")}
              className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                mobilePane === "stream"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List size={13} />
              <span>List ({displayedEvents.length})</span>
            </button>
          </div>
        </div>

        {/* 3-Pane Operations Matrix */}
        <div className="flex-1 flex flex-col xl:flex-row min-h-0 overflow-hidden relative">
          {/* Desktop Left Pane: Tactical Filter Deck (Hidden < 1280px) */}
          <div className="hidden xl:flex shrink-0 h-full overflow-hidden">
            <TacticalFilterDeck
              filters={filters}
              onFilterChange={setFilters}
              onReset={resetFilters}
            />
          </div>

          {/* Viewport Logic */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden w-full h-full">
            {/* GIS Radar Canvas & Selected Event Information Container */}
            <div
              className={`flex-1 ${
                mobilePane === "canvas" || selectedEvent ? "flex" : "hidden xl:flex"
              } h-full min-h-0 flex-col md:flex-row overflow-hidden relative`}
            >
              <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden relative">
                <GisRadarCanvas
                  events={displayedEvents}
                  selectedEvent={selectedEvent}
                  onSelectEvent={setSelectedEvent}
                />
              </div>

              {/* Event Information / Details Panel */}
              <EventDetailDrawer
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onTriageUpdate={handleTriageUpdate}
              />
            </div>

            {/* Right Pane: Live Ground Truth Event Stream */}
            <div
              className={`w-full xl:w-96 ${
                mobilePane === "stream" && !selectedEvent ? "flex" : "hidden xl:flex"
              } flex-1 md:flex-initial h-full min-h-0 flex-col overflow-hidden`}
            >
              <LiveEventStream
                events={displayedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Off-Canvas Filter Drawer (< 1280px) */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setFilterDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
          ></div>
          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <SlidersHorizontal size={15} className="text-blue-600" />
                <span>Filters & Controls</span>
              </div>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TacticalFilterDeck
                filters={filters}
                onFilterChange={setFilters}
                onReset={resetFilters}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Persistent Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around h-14 px-2 shadow-lg"
      >
        <button
          onClick={() => setMobilePane("canvas")}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
            mobilePane === "canvas" ? "text-blue-600 font-bold" : "text-slate-500"
          }`}
        >
          <Map size={18} />
          <span>Map</span>
        </button>
        <button
          onClick={() => setMobilePane("stream")}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
            mobilePane === "stream" ? "text-blue-600 font-bold" : "text-slate-500"
          }`}
        >
          <List size={18} />
          <span>List</span>
        </button>
        <button
          onClick={() => setFilterDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"
        >
          <SlidersHorizontal size={18} />
          <span>Filters</span>
        </button>
        <Link
          href="/admin/review-queue"
          className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"
        >
          <CheckSquare size={18} />
          <span>Review</span>
        </Link>
      </nav>
    </div>
  );
}
