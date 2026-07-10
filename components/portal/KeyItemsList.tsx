"use client";

import * as React from "react";
import type { KeyItem } from "./types";
import { statusBadgeClasses, checkboxBorderClass } from "./helpers";
import SectionHeading from "./SectionHeading";

/**
 * KeyItemsList — the practical checklist for the engagement.
 * Rows toggle done; items with a `docKey` get a "Review document" action that
 * opens the review modal. Progress bar reflects completed items.
 */
export interface KeyItemsListProps {
  items: KeyItem[];
  onToggle: (id: string) => void;
  onOpenDoc: (docKey: string) => void;
  onJump?: (view: "journey" | "sessions") => void;
}

export default function KeyItemsList({ items, onToggle, onOpenDoc, onJump }: KeyItemsListProps) {
  const groups = React.useMemo(() => {
    const order: string[] = [];
    const by: Record<string, typeof items> = {};
    for (const it of items) {
      const c = it.category || "General";
      if (!by[c]) { by[c] = [] as any; order.push(c); }
      by[c].push(it);
    }
    return order.map((c) => ({ category: c, items: by[c] }));
  }, [items]);
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="flex max-w-[1080px] flex-col gap-7">
        <SectionHeading
          eyebrow="The Checklist"
          title="Key items"
          lead="The practical checklist for the engagement. Check items off as they land."
        />

        {/* Progress */}
        <div className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-paper px-[26px] py-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-condensed text-[12px] font-bold uppercase tracking-label text-slate-50">
              Progress
            </span>
            <span className="text-[13px] font-medium text-slate-75">
              {doneCount} of {items.length} key items complete
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-sunken">
            <div
              className="h-full rounded bg-gradient-to-r from-teal to-gold transition-[width] duration-[420ms] ease-climb"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
          <div key={g.category} className="flex flex-col gap-2.5">
            <div className="font-condensed text-[12px] font-bold uppercase tracking-label text-slate-75">{g.category}</div>
            <div className="flex flex-col overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
          {g.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-5 border-b border-line-subtle px-7 py-[18px] transition-colors duration-[280ms] ease-climb last:border-b-0 hover:bg-rowhover"
            >
              <div className="flex min-w-[260px] flex-1 items-center gap-4">
                {item.readOnly ? (
                  <span
                    title="Handled by the Everest team"
                    aria-label="Handled by the Everest team"
                    className={[
                      "flex h-5 w-5 flex-none cursor-default items-center justify-center rounded-sm border-2 p-0 text-[12px] font-bold text-storm opacity-60",
                      checkboxBorderClass(item.status, item.done),
                    ].join(" ")}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                ) : (
                  <button
                    onClick={() => onToggle(item.id)}
                    aria-label={item.done ? "Mark incomplete" : "Mark complete"}
                    className={[
                      "flex h-5 w-5 flex-none items-center justify-center rounded-sm border-2 p-0 text-[12px] font-bold text-storm transition-[background,border-color] duration-200 ease-climb",
                      checkboxBorderClass(item.status, item.done),
                    ].join(" ")}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                )}
                <span className="flex flex-col gap-0.5">
                  <span
                    className={[
                      "text-[15px] font-medium",
                      item.done ? "text-slate-50 line-through" : "text-storm",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                  <span className="font-condensed text-[11px] font-bold uppercase tracking-label text-slate-50">
                    {item.category}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {item.docKey && (
                  <button
                    onClick={() => onOpenDoc(item.docKey!)}
                    className="rounded border border-line px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
                  >
                    {item.done ? "View document" : "Review document"}
                  </button>
                )}
                {item.phaseId && onJump && (
                  <button onClick={() => onJump("journey")} className="rounded border border-line px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]">
                    View phase →
                  </button>
                )}
                {item.sessionId && onJump && (
                  <button onClick={() => onJump("sessions")} className="rounded border border-line px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]">
                    View session →
                  </button>
                )}
                {item.required && (
                  <span className="rounded bg-gold px-3 py-[5px] font-condensed text-[11px] font-bold uppercase tracking-label text-storm">
                    Required
                  </span>
                )}
                <span
                  className={[
                    "rounded px-3 py-[5px] font-condensed text-[11px] font-bold uppercase tracking-label",
                    statusBadgeClasses(item.done ? "Complete" : item.status),
                  ].join(" ")}
                >
                  {item.done ? "Complete" : item.status}
                </span>
              </div>
            </div>
          ))}
            </div>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}
