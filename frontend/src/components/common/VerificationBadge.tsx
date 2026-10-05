import React from "react";
import { CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";

interface VerificationBadgeProps {
  status: "verified" | "pending_triage" | "pending" | "rejected" | "severe" | string;
  trustScore?: number;
  className?: string;
  size?: "sm" | "md";
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  trustScore,
  className = "",
  size = "md",
}) => {
  const normStatus = status.toLowerCase();

  let badgeClasses = "bg-slate-100 text-slate-700 border-slate-300";
  let dotColor = "bg-slate-500";
  let label = "UNDER REVIEW";
  let Icon = Clock;

  if (normStatus === "verified") {
    badgeClasses = "bg-emerald-50 text-emerald-900 border-emerald-300";
    dotColor = "bg-emerald-600";
    label = "VERIFIED";
    Icon = CheckCircle2;
  } else if (normStatus === "pending_triage" || normStatus === "pending") {
    badgeClasses = "bg-amber-50 text-amber-900 border-amber-300";
    dotColor = "bg-amber-600";
    label = "UNDER REVIEW";
    Icon = Clock;
  } else if (normStatus === "rejected") {
    badgeClasses = "bg-rose-50 text-rose-900 border-rose-300";
    dotColor = "bg-rose-600";
    label = "REJECTED";
    Icon = XCircle;
  } else if (normStatus === "severe") {
    badgeClasses = "bg-red-50 text-red-950 border-red-400";
    dotColor = "bg-red-600";
    label = "CRITICAL";
    Icon = AlertTriangle;
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-0.5 text-[11px] gap-1.5";

  const iconSize = size === "sm" ? 11 : 13;

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide uppercase border rounded ${badgeClasses} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <Icon size={iconSize} className="shrink-0" />
      <span>{label}</span>
      {trustScore !== undefined && (
        <span className="font-mono font-semibold tabular-nums ml-0.5 text-[10px] opacity-90">
          {Math.round(trustScore * 100)}%
        </span>
      )}
    </span>
  );
};
