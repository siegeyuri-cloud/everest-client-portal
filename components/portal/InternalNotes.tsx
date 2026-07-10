import * as React from "react";
import type { InternalNote } from "./types";

/**
 * InternalNotes — the Everest-team preview panel (dashed, clearly labeled
 * "internal"). In production this is role-gated; here it is a visible preview.
 */
export interface InternalNotesProps {
  notes: InternalNote[];
}

export default function InternalNotes({ notes }: InternalNotesProps) {
  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="mx-auto box-border flex max-w-[1080px] flex-col gap-[26px] rounded-lg border-regular border-dashed border-slate-25 bg-parchment p-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded bg-storm px-3 py-[5px] font-condensed text-[11px] font-bold uppercase tracking-label text-snow">
              Internal · Everest team only
            </span>
            <span className="font-condensed text-[15px] font-bold uppercase tracking-label text-storm">
              Team operating notes
            </span>
          </div>
          <span className="text-[12.5px] italic text-slate-50">
            In the real build this tab is role-based. Clients never see it.
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
          {notes.map((n, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-md border border-line-subtle bg-paper px-[22px] pb-5 pt-[22px]"
            >
              <div className="font-condensed text-[12px] font-bold uppercase tracking-wide text-slate-50">
                {n.label}
              </div>
              <div className="text-[13.5px] leading-[1.65] text-ink">{n.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
