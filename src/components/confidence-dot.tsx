"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfidenceDotProps {
  confidence: number | null;
  source?: string | null;
}

export function ConfidenceDot({ confidence, source }: ConfidenceDotProps) {
  const level = confidence == null ? "unknown"
    : confidence >= 0.8 ? "high"
    : confidence >= 0.5 ? "moderate"
    : "low";

  const color = {
    high: "bg-ns-green",
    moderate: "bg-ns-amber",
    low: "bg-ns-red",
    unknown: "bg-muted-foreground",
  }[level];

  const label = {
    high: "High confidence",
    moderate: "Moderate confidence",
    low: "Low confidence",
    unknown: "No data",
  }[level];

  return (
    <Tooltip>
      <TooltipTrigger className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <TooltipContent>
        <p className="text-xs">
          {label}
          {confidence != null && ` (${Math.round(confidence * 100)}%)`}
          {source && ` — ${source}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
