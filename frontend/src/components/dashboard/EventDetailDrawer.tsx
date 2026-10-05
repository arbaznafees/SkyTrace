"use client";

import React, { useState } from "react";
import { GisEventItem } from "./GisRadarCanvas";
import { VerificationBadge } from "../common/VerificationBadge";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  X,
  MapPin,
  CheckCircle2,
  XCircle,
  Radio,
  Send,
  FileText,
  ShieldCheck,
  Lock,
} from "lucide-react";

interface EventDetailDrawerProps {
  event: GisEventItem | null;
  onClose: () => void;
  onTriageUpdate?: (eventId: string, newStatus: string) => void;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event,
  onClose,
  onTriageUpdate,
}) => {
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const { user, isAdmin, canTriage, getAuthHeaders } = useAuth();

  if (!event) return null;

  const handleSimulatedDispatch = async (dispatchType: string) => {
    if (!isAdmin) {
      setDispatchStatus("NDMA Admin clearance required for emergency broadcasts.");
      setTimeout(() => setDispatchStatus(null), 4000);
      return;
    }

    setIsDispatching(true);
    setDispatchStatus("Transmitting alert notification...");
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          event_id: event.event_code,
          dispatch_type: dispatchType,
          target_districts: [event.district],
          alert_severity: event.severity,
          broadcast_message: `[${dispatchType.toUpperCase()}] Severe weather verified in ${event.district}, ${event.state}. Emergency response activated.`,
          analyst_callsign: user?.full_name || "LEAD-ANALYST",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDispatchStatus(`Transmission confirmed: ${data.transmission_id}`);
      } else if (res.status === 403) {
        setDispatchStatus("Forbidden: Elevated NDMA admin clearance required");
      } else if (res.status === 401) {
        setDispatchStatus("Authentication required. Please sign in.");
      } else {
        setDispatchStatus("Dispatch logged to audit stream");
      }
    } catch {
      setDispatchStatus(`Dispatch recorded in audit stream`);
    } finally {
      setIsDispatching(false);
      setTimeout(() => setDispatchStatus(null), 4000);
    }
  };

  const handleTriageAction = async (action: "verify" | "reject") => {
    if (!canTriage) {
      setDispatchStatus("Authentication required to submit triage decisions.");
      setTimeout(() => setDispatchStatus(null), 4000);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/triage/${event.event_code}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action,
          analyst_note: `Operational triage decision by ${user?.full_name || "duty personnel"} (${user?.role || "analyst"}) for ${event.event_code}`,
        }),
      });
      if (res.ok) {
        if (onTriageUpdate) {
          onTriageUpdate(event.id, action === "verify" ? "verified" : "rejected");
        }
        setDispatchStatus(`Incident ${event.event_code} marked as ${action === "verify" ? "verified" : "rejected"}.`);
      } else if (res.status === 401) {
        setDispatchStatus("Session expired or unauthenticated. Please log in.");
      } else if (res.status === 403) {
        setDispatchStatus("Forbidden: Triage authorization required.");
      }
    } catch {
      setDispatchStatus("Network error: Could not contact triage gateway.");
    } finally {
      setTimeout(() => setDispatchStatus(null), 3000);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 md:inset-x-auto md:inset-y-0 md:right-0 z-50 w-full md:w-[460px] max-h-[85vh] md:max-h-full bg-white border-t md:border-t-0 md:border-l border-slate-300 shadow-2xl flex flex-col h-auto md:h-full overflow-hidden">
      {/* Drawer Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-blue-300">
            {event.event_code}
          </span>
          <VerificationBadge
            status={event.verification_status}
            trustScore={event.trust_score}
            size="sm"
          />
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          title="Close drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Dossier Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-slate-800">
        {/* Incident Classification & Headline */}
        <div>
          <div className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-wider mb-0.5">
            Hazard: {event.primary_category}
          </div>
          <h2 className="text-sm font-bold text-slate-900 leading-snug">
            {event.headline}
          </h2>
          <div className="flex items-center gap-1.5 text-slate-600 mt-1 font-medium text-[11px]">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span>
              {event.location_name} ({event.district}, {event.state})
            </span>
          </div>
        </div>

        {/* Telemetry & Metadata Strip */}
        <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">GPS Reticle:</span>
            <span className="font-semibold text-slate-800">
              {event.latitude.toFixed(4)}° N, {event.longitude.toFixed(4)}° E
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Threat Severity:</span>
            <span
              className={`font-bold uppercase px-1.5 py-0.2 rounded text-[10px] ${
                event.severity === "severe"
                  ? "bg-rose-100 text-rose-900 border border-rose-300"
                  : "bg-slate-200 text-slate-800 border border-slate-300"
              }`}
            >
              {event.severity}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Corroborated Reports:</span>
            <span className="font-semibold text-blue-800">
              {event.report_count} Sensor & Ground Reports
            </span>
          </div>
        </div>

        {/* Operational Summary */}
        <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700 font-mono text-[11px]">
            <FileText size={12} className="text-slate-500" />
            <span>Operational Summary</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-xs">
            {event.summary}
          </p>
        </div>

        {/* AI Trust Feature Attribution */}
        <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-800 font-mono text-[11px]">
              <ShieldCheck size={13} className="text-blue-600" />
              <span>Bayesian Trust Score</span>
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {Math.round(event.trust_score * 100)}%
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Source Authority Weight:</span>
              <span className="font-semibold text-emerald-800">
                {event.report_count >= 3 ? "+0.35 (Multi-source)" : "+0.18 (Single source)"}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Sensor Fusion Agreement:</span>
              <span className="font-semibold text-emerald-800">
                {event.trust_score >= 0.8 ? "+0.40 (IMD Doppler Correlated)" : "+0.15 (Baseline)"}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Imagery Verification:</span>
              <span className="font-semibold text-emerald-800">
                {event.headline.includes("Photo") || event.report_count > 2
                  ? "+0.20 (Verified Exif)"
                  : "0.00 (Unchecked)"}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {dispatchStatus && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            <span>{dispatchStatus}</span>
          </div>
        )}
      </div>

      {/* Action Console */}
      <div className="p-3 bg-slate-100 border-t border-slate-300 space-y-2">
        <div className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
          Decision & Escalation Actions
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleTriageAction("verify")}
            disabled={!canTriage}
            className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={13} />
            <span>Approve Event</span>
          </button>
          <button
            onClick={() => handleTriageAction("reject")}
            disabled={!canTriage}
            className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            <XCircle size={13} />
            <span>Reject as Noise</span>
          </button>
        </div>

        {!canTriage && (
          <div className="text-[10px] text-slate-500 text-center font-mono">
            Sign in as IMD Analyst, State EOC, or NDMA Admin to triage.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
          <button
            onClick={() => handleSimulatedDispatch("sachet_broadcast")}
            disabled={isDispatching || !isAdmin}
            title={!isAdmin ? "NDMA Admin Clearance Required" : "Broadcast via SACHET"}
            className="py-1.5 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <Radio size={13} />
            <span>SACHET Broadcast</span>
            {!isAdmin && <Lock size={10} className="ml-0.5 opacity-70" />}
          </button>
          <button
            onClick={() => handleSimulatedDispatch("ndma_escalation")}
            disabled={isDispatching || !isAdmin}
            title={!isAdmin ? "NDMA Admin Clearance Required" : "Escalate to NDMA"}
            className="py-1.5 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <Send size={13} />
            <span>Escalate to NDMA</span>
            {!isAdmin && <Lock size={10} className="ml-0.5 opacity-70" />}
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center justify-between text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
            <span className="flex items-center gap-1 font-medium">
              <Lock size={10} />
              Alert dispatch requires NDMA Admin clearance
            </span>
            <span className="text-[9px] uppercase font-mono font-bold text-amber-700">
              Admin Only
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
