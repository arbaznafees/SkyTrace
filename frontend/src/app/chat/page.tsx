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
  Clock,
  Radio,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function normalizeMarkdown(text: string): string {
  if (!text) return "";
  // Unescape backslash-escaped markdown formatting characters (*, _, #, [, ], (, ))
  // Leaves legitimate backslashes, code blocks, URLs, JSON, and math intact
  return text.replace(/\\([*_#[\]()])/g, "$1");
}

function isExternalUrl(href?: string): boolean {
  if (!href) return false;
  // Relative links and hash anchors are always internal
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
        // Clean error response without fabricated data
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900 font-sans pb-4">
      {/* Header */}
      <TacticalHeader stats={stats} />

      {/* Main Chat Interface */}
      <main className="flex-1 pt-24 px-4 sm:px-6 max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-2rem)]">
        {/* Chat Card Container */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <Bot size={18} />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-bold text-slate-900">
                  SkyTrace Disaster Intelligence Copilot
                </h1>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span>Synthesizing live Doppler telemetry & crowdsourced reports</span>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
            >
              <span>Operations Map</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {/* Quick Prompt Pills */}
          <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-slate-400 uppercase shrink-0">
              Suggested Inquiries:
            </span>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 text-xs bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-full transition-colors shrink-0 shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={16} />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-4 text-xs leading-relaxed space-y-2.5 ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-none shadow-xs"
                        : "bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-none shadow-2xs"
                    }`}
                  >
                    {/* Timestamp & Engine Attribution */}
                    <div
                      className={`flex items-center justify-between text-[10px] pb-1 border-b ${
                        isUser
                          ? "border-blue-500 text-blue-100"
                          : "border-slate-200 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>
                          {isUser ? "Field Analyst / Observer" : msg.engine || "SkyTrace Copilot"}
                        </span>
                        {msg.ragUsed && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-medium border border-blue-200">
                            <ShieldCheck size={10} />
                            <span>Grounded Telemetry</span>
                          </span>
                        )}
                      </div>
                      <span>{msg.timestamp}</span>
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
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 mt-2.5 mb-1">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xs font-bold text-slate-900 mt-2 mb-1">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-900 mt-1.5 mb-0.5">{children}</h3>,
                            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-1.5">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            code: ({ children }) => (
                              <code className="px-1.5 py-0.5 bg-slate-200/70 text-slate-900 rounded font-mono text-[11px]">
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
                                  className="text-blue-600 hover:text-blue-800 underline font-medium inline-flex items-center gap-0.5 transition-colors"
                                >
                                  <span>{children}</span>
                                  {isExternal && <ExternalLink size={10} className="inline shrink-0" />}
                                </a>
                              );
                            },
                          }}
                        >
                          {normalizeMarkdown(msg.text)}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Attached Tactical Map Snippet Component (Rendered strictly when ragUsed is true) */}
                    {msg.ragUsed && msg.mapSnippets && msg.mapSnippets.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200 space-y-2">
                        {msg.mapSnippets.map((snippet) => {
                          const normStatus = (snippet.verification_status || "").toLowerCase();
                          const isVerified = normStatus === "verified";
                          const isRejected = normStatus === "rejected";
                          const borderColor = isVerified
                            ? "border-l-emerald-500"
                            : isRejected
                            ? "border-l-rose-500"
                            : "border-l-amber-500";

                          return (
                            <div
                              key={snippet.event_id}
                              className={`bg-white rounded-lg p-3 border border-slate-200 shadow-xs border-l-4 ${borderColor} space-y-2`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] font-bold text-slate-900">
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
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <MapPin size={11} className="text-slate-400" />
                                <span>
                                  {snippet.location_name} • {snippet.district}, {snippet.state}
                                </span>
                              </div>

                              {/* Deep Action Links */}
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <Link
                                  href={`/dashboard?event=${snippet.event_code}`}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                                >
                                  <Map size={12} />
                                  <span>View on GIS Tactical Canvas</span>
                                </Link>
                                <Link
                                  href="/citizen-report"
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors border border-slate-200"
                                >
                                  <FilePlus size={12} />
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
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={16} />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-700 flex items-center gap-2.5 shadow-2xs">
                  <Sparkles size={14} className="text-blue-600 animate-spin shrink-0" />
                  <span className="text-slate-700 font-medium">SkyTrace Assistant is thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Console */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
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
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:cursor-not-allowed shrink-0"
              >
                <Send size={13} />
                <span>Send</span>
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Enter a district name, hazard category, or incident ID</span>
              <span className="font-mono">NDMA • IMD TACTICAL DEFENSE</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
