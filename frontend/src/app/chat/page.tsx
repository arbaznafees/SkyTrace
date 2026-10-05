"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TacticalHeader } from "@/components/common/TacticalHeader";
import { VerificationBadge } from "@/components/common/VerificationBadge";
import { API_BASE, HeaderStats, fetchHeaderStats } from "@/lib/api";
import {
  Send,
  Bot,
  User,
  MapPin,
  Map,
  FilePlus,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  Layers,
  Database,
  Satellite,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function normalizeMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/\\([*_#[\]()])/g, "$1");
}

function isExternalUrl(href?: string): boolean {
  if (!href) return false;
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?") || href.startsWith("./") || href.startsWith("../")) {
    return false;
  }
  try {
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const parsed = new URL(href, currentOrigin || "http://localhost:3000");
    if (currentOrigin) {
      return parsed.origin !== currentOrigin;
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface MapSnippet {
  event_id: string;
  event_code: string;
  latitude: number;
  longitude: number;
  primary_category: string;
  severity: string;
  headline: string;
  location_name: string;
  district: string;
  state: string;
  trust_score: number;
  verification_status: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  timestamp: string;
  text: string;
  engine?: string;
  citedEvents?: string[];
  mapSnippets?: MapSnippet[];
  ragUsed?: boolean;
  intent?: string;
}

const QUICK_PROMPTS = [
  "Any active flash flood alerts in Puri, Odisha?",
  "When will the thunderstorm squall line pass Cachar, Assam?",
  "How severe is the heatwave warning in Churu, Rajasthan?",
  "Are roads safe to drive around East Singhbhum, Jharkhand?",
];

export default function SkyTraceChatPage() {
  const [stats, setStats] = useState<HeaderStats | null>(null);

  useEffect(() => {
    fetchHeaderStats().then((data) => {
      if (data) setStats(data);
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === "msg-welcome-1" && m.timestamp === "LIVE UTC"
          ? { ...m, timestamp: new Date().toUTCString().slice(17, 25) + " UTC" }
          : m
      )
    );
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome-1",
      sender: "assistant",
      timestamp: "LIVE UTC",
      engine: "SkyTrace Disaster Intelligence Assistant",
      text: "Welcome to SkyTrace Operational Assistant. Powered by INSAT-3D Doppler radar telemetry and verified citizen observations. Ask about localized severe weather alerts, road inundation, or evacuation advisories across India.",
      ragUsed: false,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const nowUtc = new Date().toUTCString().slice(17, 25) + " UTC";

    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      timestamp: nowUtc,
      text: query,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          session_id: "session-civic-01",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const ragUsed = Boolean(data.rag_used);
        const snippets: MapSnippet[] = ragUsed && Array.isArray(data.map_snippets) ? data.map_snippets : [];

        const replyMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          timestamp: new Date().toUTCString().slice(17, 25) + " UTC",
          text: data.reply || data.response || "No response data available.",
          engine: data.engine || "SkyTrace Copilot",
          citedEvents: ragUsed ? data.cited_events || [] : [],
          mapSnippets: snippets,
          ragUsed: ragUsed,
          intent: data.intent || (ragUsed ? "OPERATIONAL_WEATHER" : "CONVERSATIONAL"),
        };

        setMessages((prev) => [...prev, replyMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: "assistant",
            timestamp: new Date().toUTCString().slice(17, 25) + " UTC",
            text: "The SkyTrace intelligence service is temporarily unavailable. Please try again shortly.",
            engine: "SkyTrace System",
            ragUsed: false,
            mapSnippets: [],
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          timestamp: new Date().toUTCString().slice(17, 25) + " UTC",
          text: "The SkyTrace intelligence service is temporarily unreachable. Please check your connection or try again shortly.",
          engine: "SkyTrace System",
          ragUsed: false,
          mapSnippets: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Collect all cited events across recent messages for the side Context panel
  const allRecentSnippets: MapSnippet[] = [];
  messages.forEach((m) => {
    if (m.mapSnippets) {
      m.mapSnippets.forEach((s) => {
        if (!allRecentSnippets.find((x) => x.event_code === s.event_code)) {
          allRecentSnippets.push(s);
        }
      });
    }
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900 font-sans pb-4">
      {/* Header */}
      <TacticalHeader stats={stats} />

      {/* Main Operational Workspace */}
      <main className="flex-1 pt-24 px-3 sm:px-6 max-w-7xl mx-auto w-full flex flex-col h-[calc(100vh-2rem)]">
        {/* Workspace Card Container */}
        <div className="flex-1 bg-white rounded border border-slate-300 shadow-xs flex flex-col overflow-hidden">
          {/* Workspace Bar */}
          <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">
                <Bot size={14} />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white font-mono uppercase">
                  SkyTrace Disaster Intelligence Copilot
                </h1>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span>INSAT-3D Doppler RAG Grounded</span>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-xs text-blue-300 hover:text-white font-semibold flex items-center gap-1 font-mono"
            >
              <span>Operations Map</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {/* Quick Prompt Pills Bar */}
          <div className="px-3.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase shrink-0">
              Suggested Inquiries:
            </span>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-0.5 text-[11px] bg-white hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded font-medium transition-colors shrink-0 shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Dual-Pane Layout: [Conversation Stream | Context & Data Sources] */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left/Main: Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs">
                        <Bot size={14} />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[78%] rounded p-3 text-xs leading-relaxed space-y-2 ${
                        isUser
                          ? "bg-slate-900 text-white rounded-tr-none"
                          : "bg-slate-50 text-slate-900 border border-slate-300 rounded-tl-none shadow-2xs"
                      }`}
                    >
                      {/* Timestamp & Engine Attribution */}
                      <div
                        className={`flex items-center justify-between text-[10px] font-mono pb-1 border-b ${
                          isUser
                            ? "border-slate-700 text-slate-400"
                            : "border-slate-200 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span>
                            {isUser ? "Field Analyst / Observer" : msg.engine || "SkyTrace Copilot"}
                          </span>
                          {msg.ragUsed && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-blue-100 text-blue-900 rounded text-[9px] font-bold border border-blue-300">
                              <ShieldCheck size={9} />
                              <span>Grounded Telemetry</span>
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums">{msg.timestamp}</span>
                      </div>

                      {/* Message Body */}
                      {isUser ? (
                        <p className="whitespace-pre-line text-xs font-normal">
                          {msg.text}
                        </p>
                      ) : (
                        <div className="text-xs leading-relaxed space-y-2 text-slate-800 break-words">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                              h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 mt-2 mb-1">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-xs font-bold text-slate-900 mt-1.5 mb-0.5">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-900 mt-1 mb-0.5">{children}</h3>,
                              strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              code: ({ children }) => (
                                <code className="px-1 py-0.2 bg-slate-200 text-slate-900 rounded font-mono text-[10px]">
                                  {children}
                                </code>
                              ),
                              a: ({ href, children }) => {
                                const isExternal = isExternalUrl(href);
                                return (
                                  <a
                                    href={href}
                                    target={isExternal ? "_blank" : undefined}
                                    rel={isExternal ? "noopener noreferrer" : undefined}
                                    className="text-blue-700 hover:text-blue-900 underline font-medium inline-flex items-center gap-0.5 transition-colors"
                                  >
                                    <span>{children}</span>
                                    {isExternal && <ExternalLink size={9} className="inline shrink-0" />}
                                  </a>
                                );
                              },
                            }}
                          >
                            {normalizeMarkdown(msg.text)}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Attached Tactical Map Snippet Component */}
                      {msg.ragUsed && msg.mapSnippets && msg.mapSnippets.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-2">
                          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                            Corroborated Incident Telemetry:
                          </div>
                          {msg.mapSnippets.map((snippet) => {
                            const normStatus = (snippet.verification_status || "").toLowerCase();
                            const isVerified = normStatus === "verified";
                            const isRejected = normStatus === "rejected";
                            const borderColor = isVerified
                              ? "border-l-emerald-600"
                              : isRejected
                              ? "border-l-rose-600"
                              : "border-l-amber-500";

                            return (
                              <div
                                key={snippet.event_id}
                                className={`bg-white rounded p-2.5 border border-slate-300 shadow-2xs border-l-3 ${borderColor} space-y-1.5`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-bold text-slate-900">
                                    {snippet.event_code}
                                  </span>
                                  <VerificationBadge
                                    status={snippet.verification_status || "pending"}
                                    trustScore={snippet.trust_score}
                                    size="sm"
                                  />
                                </div>
                                <div className="text-xs font-bold text-slate-900">
                                  {snippet.headline}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-600 font-mono">
                                  <MapPin size={10} className="text-slate-400" />
                                  <span>
                                    {snippet.location_name} • {snippet.district}, {snippet.state}
                                  </span>
                                </div>

                                {/* Deep Action Links */}
                                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                                  <Link
                                    href={`/dashboard?event=${snippet.event_code}`}
                                    className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors font-mono"
                                  >
                                    <Map size={11} />
                                    <span>View on GIS Tactical Canvas</span>
                                  </Link>
                                  <Link
                                    href="/citizen-report"
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors border border-slate-300 font-mono"
                                  >
                                    <FilePlus size={11} />
                                    <span>Report Ground Conditions Here</span>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded bg-slate-200 text-slate-800 flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs">
                        <User size={14} />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded bg-slate-800 text-blue-400 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-700 flex items-center gap-2 shadow-2xs font-mono">
                    <Sparkles size={12} className="text-blue-600 animate-spin shrink-0" />
                    <span>SkyTrace Assistant is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Right: Operational Context / Telemetry Sources Panel */}
            <aside className="hidden lg:flex w-72 bg-slate-50 border-l border-slate-300 flex-col justify-between p-3.5 space-y-4 overflow-y-auto">
              <div className="space-y-3.5">
                <div className="border-b border-slate-200 pb-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Telemetry & Data Sources
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    Operational Grounding Status
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Satellite size={12} className="text-blue-600" />
                        INSAT-3D Doppler
                      </span>
                      <span className="text-emerald-700 text-[10px]">Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      DWR East Coast radar reflectivity & storm locus feeds synced.
                    </p>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Database size={12} className="text-blue-600" />
                        Ground Truth RAG
                      </span>
                      <span className="text-emerald-700 text-[10px]">Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Bayesian verified incidents cross-referenced for operational accuracy.
                    </p>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Layers size={12} className="text-blue-600" />
                        AI Verification
                      </span>
                      <span className="text-blue-700 font-mono text-[10px]">gemini-3.5-flash-lite</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Strict status-aware grounding: rejected events excluded from operational advice.
                    </p>
                  </div>
                </div>

                {/* Cited Events in Session */}
                {allRecentSnippets.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Referenced Incidents ({allRecentSnippets.length})
                    </div>
                    <div className="space-y-1">
                      {allRecentSnippets.map((s) => (
                        <Link
                          key={s.event_code}
                          href={`/dashboard?event=${s.event_code}`}
                          className="block bg-white p-2 rounded border border-slate-200 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-800">
                            <span>{s.event_code}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-500">{s.severity}</span>
                          </div>
                          <div className="text-[10px] text-slate-600 truncate mt-0.5">
                            {s.district}, {s.state}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2 bg-white rounded border border-slate-200 text-[10px] font-mono text-slate-500 space-y-0.5">
                <div className="font-bold text-slate-700">Safety & ETA Rule</div>
                <div>Estimates strictly derived from complete telemetry. No fabricated forecast times.</div>
              </div>
            </aside>
          </div>

          {/* Chat Input Console */}
          <div className="p-3 bg-slate-100 border-t border-slate-300">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about active cyclone alerts, flash floods, or localized weather warnings..."
                className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white disabled:text-slate-500 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:cursor-not-allowed shrink-0 font-mono uppercase tracking-wider"
              >
                <Send size={12} />
                <span>Send</span>
              </button>
            </form>
            <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500 font-mono px-0.5">
              <span>Query by district name, meteorological hazard, or incident code</span>
              <span>NDMA • IMD TACTICAL OPERATIONAL COPILOT</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
