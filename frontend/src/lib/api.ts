/**
 * SkyTrace Tactical API Gateway Configuration
 * Automatically resolves to NEXT_PUBLIC_API_BASE_URL (Render production) or localhost:8000.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

export interface HeaderStats {
  totalEvents: number;
  pendingCount: number;
  severeCount: number;
}

export async function fetchHeaderStats(): Promise<HeaderStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/events/stats`);
    if (res.ok) {
      const data = await res.json();
      return {
        totalEvents: data.total_active_events ?? 0,
        pendingCount: data.pending_triage_count ?? 0,
        severeCount: data.severe_alert_count ?? 0,
      };
    }
  } catch (err) {
    console.warn("Live telemetry stats fetch failed:", err);
  }
  return null;
}
