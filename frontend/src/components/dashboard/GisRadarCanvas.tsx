"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

export interface GisEventItem {
  id: string;
  event_code: string;
  primary_category: string;
  severity: string;
  headline: string;
  summary: string;
  latitude: number;
  longitude: number;
  location_name: string;
  district: string;
  state: string;
  report_count: number;
  trust_score: number;
  verification_status: string;
}

interface GisRadarCanvasProps {
  events: GisEventItem[];
  selectedEvent: GisEventItem | null;
  onSelectEvent: (event: GisEventItem) => void;
}

export const GisRadarCanvas: React.FC<GisRadarCanvasProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hudCoords, setHudCoords] = useState<{ lat: string; lon: string }>({
    lat: "19.8135° N",
    lon: "85.8312° E",
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    if (mapInstanceRef.current || (mapContainerRef.current as any)._leaflet_id) return;

    let isCancelled = false;

    import("leaflet").then((L) => {
      if (isCancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current || (mapContainerRef.current as any)._leaflet_id) return;

      const map = L.map(mapContainerRef.current, {
        center: [21.0, 82.0], // Center on India / East Coast corridor
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
      });

      // Humanitarian OpenStreetMap (HOT) disaster tiles (100% free, zero API key, zero watermark)
      L.tileLayer(
        "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
        }
      ).addTo(map);

      // Clean Zoom control at bottom left
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      // Mousemove listener for HUD coordinates
      map.on("mousemove", (e: any) => {
        const lat = e.latlng.lat.toFixed(4);
        const lng = e.latlng.lng.toFixed(4);
        setHudCoords({
          lat: `${Math.abs(Number(lat))}° ${Number(lat) >= 0 ? "N" : "S"}`,
          lon: `${Math.abs(Number(lng))}° ${Number(lng) >= 0 ? "E" : "W"}`,
        });
      });

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);

      // Invalidate size to ensure full tile coverage
      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    });

    return () => {
      isCancelled = true;
      setMapReady(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Update map markers when events, selectedEvent, or mapReady change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      events.forEach((evt) => {
        const isSelected = selectedEvent?.id === evt.id;

        let bgHex = "#10b981"; // emerald for verified
        if (evt.verification_status === "pending_triage" || evt.verification_status === "pending") {
          bgHex = "#f59e0b"; // amber for pending
        } else if (
          evt.verification_status === "rejected" ||
          evt.severity === "severe"
        ) {
          bgHex = "#ef4444"; // red for severe / rejected
        }

        const size = isSelected ? 28 : 22;
        const iconHtml = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 9999px;
            background-color: ${bgHex};
            border: 2.5px solid #ffffff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25)${isSelected ? ", 0 0 0 3px #1d4ed8" : ""};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            <div style="width: 6px; height: 6px; border-radius: 9999px; background-color: #ffffff;"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-map-pin",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([evt.latitude, evt.longitude], {
          icon: customIcon,
        });

        marker.on("click", () => {
          onSelectEvent(evt);
        });

        marker.bindTooltip(
          `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; color: #0f172a; padding: 6px 10px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: -apple-system, sans-serif; font-size: 12px; line-height: 1.3;">
            <div style="font-weight: 700; color: ${bgHex}; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
              ${evt.event_code} • ${evt.primary_category.toUpperCase()}
            </div>
            <div style="font-weight: 600; color: #1e293b;">${evt.location_name || evt.district}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
              ${evt.district}, ${evt.state} • Trust: ${Math.round(evt.trust_score * 100)}%
            </div>
          </div>
        `,
          { direction: "top", offset: [0, -10], opacity: 1 }
        );

        markersLayerRef.current.addLayer(marker);
      });

      // If selectedEvent changes, pan to it smoothly
      if (selectedEvent) {
        mapInstanceRef.current.setView(
          [selectedEvent.latitude, selectedEvent.longitude],
          8,
          { animate: true }
        );
      }
    });
  }, [events, selectedEvent, onSelectEvent, mapReady]);

  return (
    <div className="relative flex-1 h-full min-h-[450px] bg-slate-100 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Clean Status Overlay (Top Left) */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-semibold text-slate-800">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>GIS Ground Truth Map</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500 font-normal">
          {events.length} Active Incidents
        </span>
      </div>

      {/* Reticle Coordinates (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm text-xs text-slate-700 flex items-center gap-3">
        <Navigation size={13} className="text-blue-600" />
        <div className="flex items-center gap-3 tabular-nums font-mono text-[11px]">
          <span>
            <strong className="text-slate-500 font-sans">Lat:</strong> {hudCoords.lat}
          </span>
          <span>
            <strong className="text-slate-500 font-sans">Lon:</strong> {hudCoords.lon}
          </span>
        </div>
      </div>
    </div>
  );
};
