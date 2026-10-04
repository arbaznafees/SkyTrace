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

  let badgeClasses = "bg-slate-100 text-slate-700 border-slate-200";
  let label = "UNDER REVIEW";
  let Icon = Clock;

  if (normStatus === "verified") {
    badgeClasses = "bg-emerald-50 text-emerald-800 border-emerald-200";
    label = "VERIFIED";
    Icon = CheckCircle2;
  } else if (normStatus === "pending_triage" || normStatus === "pending") {
    badgeClasses = "bg-amber-50 text-amber-800 border-amber-200";
    label = "UNDER REVIEW";
    Icon = Clock;
  } else if (normStatus === "rejected") {
    badgeClasses = "bg-rose-50 text-rose-800 border-rose-200";
    label = "REJECTED";
    Icon = XCircle;
  } else if (normStatus === "severe") {
    badgeClasses = "bg-red-50 text-red-800 border-red-200";
    label = "CRITICAL";
    Icon = AlertTriangle;
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  const iconSize = size === "sm" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-md shadow-xs ${badgeClasses} ${sizeClasses} ${className}`}
    >
      <Icon size={iconSize} className="shrink-0" />
      <span>{label}</span>
      {trustScore !== undefined && (
        <span className="font-semibold tabular-nums ml-0.5 opacity-90">
          ({Math.round(trustScore * 100)}%)
        </span>
      )}
    </span>
  );
};
