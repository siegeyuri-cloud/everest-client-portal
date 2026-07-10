import * as React from "react";

/**
 * TopBar — slim sticky header over the main column.
 * Shows the active screen label, portal URL, last-updated, and live status.
 */
export interface TopBarProps {
  activeLabel: string;   // {activeScreenLabel}
  portalUrl: string;     // {portalUrl}
  lastUpdated: string;   // {lastUpdated}
  status: string;        // {statusLabel} — e.g. "In Progress"
}

export default function TopBar({ activeLabel, portalUrl, lastUpdated, status }: TopBarProps) {
  return (
    <div className="sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle bg-paper px-9 py-3.5">
      <div className="font-condensed text-[14px] font-bold uppercase tracking-label text-storm">
        {activeLabel}
      </div>
      <div className="flex items-center gap-3.5 font-condensed text-[11.5px] uppercase tracking-label text-slate-50">
        <span>{portalUrl}</span>
        <span className="h-3 w-px bg-line" />
        <span>Updated {lastUpdated}</span>
        <span className="h-3 w-px bg-line" />
        <span className="flex items-center gap-[7px]">
          <span className="h-[7px] w-[7px] rounded-full bg-teal" />
          <span className="font-bold text-teal-deep">{status}</span>
        </span>
      </div>
    </div>
  );
}
