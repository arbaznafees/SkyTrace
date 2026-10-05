"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";

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
        center: [21.0, 82.0], // Center on India
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
      });

      // Humanitarian OpenStreetMap (HOT) disaster tiles
      L.tileLayer(
        "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);

      // Zoom control at bottom left
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

        let bgHex = "#059669"; // emerald for verified
        if (evt.verification_status === "pending_triage" || evt.verification_status === "pending") {
          bgHex = "#d97706"; // amber for pending
        } else if (
          evt.verification_status === "rejected" ||
          evt.severity === "severe"
        ) {
          bgHex = "#dc2626"; // red for severe / rejected
        }

        const size = isSelected ? 24 : 18;
        const iconHtml = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 9999px;
            background-color: ${bgHex};
            border: 2px solid #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.35)${isSelected ? ", 0 0 0 3px #1d4ed8" : ""};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            <div style="width: 5px; height: 5px; border-radius: 9999px; background-color: #ffffff;"></div>
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
          <div style="background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 6px 10px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); font-family: -apple-system, sans-serif; font-size: 11px; line-height: 1.3;">
            <div style="font-weight: 700; color: #60a5fa; font-family: monospace; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
              ${evt.event_code} • ${evt.primary_category.toUpperCase()}
            </div>
            <div style="font-weight: 600; color: #ffffff;">${evt.location_name || evt.district}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">
              ${evt.district}, ${evt.state} • Trust: ${Math.round(evt.trust_score * 100)}%
            </div>
          </div>
        `,
          { direction: "top", offset: [0, -10], opacity: 1 }
        );

        markersLayerRef.current.addLayer(marker);
      });

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
    <div className="relative flex-1 h-full min-h-[400px] bg-slate-200 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Clean Status Overlay (Top Left) */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 bg-slate-900/90 text-white backdrop-blur-xs px-2.5 py-1 rounded border border-slate-700 shadow-sm text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-mono uppercase text-[11px] tracking-wide">GIS Radar Grid</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-300 font-mono text-[11px] font-normal">
          {events.length} Incidents
        </span>
      </div>

      {/* Reticle Coordinates (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-[400] bg-slate-900/90 text-white backdrop-blur-xs border border-slate-700 rounded px-2.5 py-1 shadow-sm text-xs flex items-center gap-2.5">
        <Navigation size={12} className="text-blue-400" />
        <div className="flex items-center gap-3 tabular-nums font-mono text-[10px]">
          <span>
            <strong className="text-slate-400 font-sans text-[10px]">Lat:</strong> {hudCoords.lat}
          </span>
          <span>
            <strong className="text-slate-400 font-sans text-[10px]">Lon:</strong> {hudCoords.lon}
          </span>
        </div>
      </div>
    </div>
  );
};
