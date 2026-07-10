"use client";

import * as React from "react";
import type { ResourceSection } from "./types";
import SectionHeading from "./SectionHeading";
import { PeakBullet } from "./icons";

/**
 * ResourceList — the collapsible field-guide accordion. Each section expands
 * to an intro line plus peak-bulleted items (bold label + detail).
 * `openKeys` / `onToggle` are controlled by the parent so state survives view swaps.
 */
export interface ResourceListProps {
  sections: ResourceSection[];
  openNums: string[];              // which section `num`s are expanded
  onToggle: (num: string) => void;
}

export default function ResourceList({ sections, openNums, onToggle }: ResourceListProps) {
  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <SectionHeading
          eyebrow="Field Guide"
          title="Everything for this engagement"
          lead="Open what you need, when you need it. We keep every section current."
        />

        <div className="flex flex-col border-t border-line">
          {sections.map((section) => {
            const open = openNums.includes(section.num);
            return (
              <div key={section.num} className="border-b border-line">
                <button
                  onClick={() => onToggle(section.num)}
                  className="flex w-full items-center justify-between gap-4 px-2 py-[22px] text-left transition-[background,padding] duration-[280ms] ease-climb hover:bg-black/[0.04] hover:px-3.5"
                >
                  <span className="flex items-center gap-4">
                    <span className="w-6 font-condensed text-[12px] font-bold tracking-label text-slate-50">
                      {section.num}
                    </span>
                    <span className="font-condensed text-[17px] font-bold uppercase tracking-label text-storm">
                      {section.title}
                    </span>
                  </span>
                  <span className="text-[22px] font-light leading-none text-teal-deep">
                    {open ? "–" : "+"}
                  </span>
                </button>

                {open && (
                  <div className="flex max-w-[760px] animate-fade-up flex-col gap-3.5 px-2 pb-[30px] pl-12 pt-1">
                    <div className="text-[14.5px] leading-relaxed text-ink">{section.intro}</div>
                    <div className="flex flex-col gap-2.5">
                      {section.items.map((it, i) => (
                        <div key={i} className="flex items-baseline gap-3">
                          <PeakBullet tone={it.tone} className="translate-y-[-1px]" />
                          <span className="text-[14px] leading-[1.6] text-ink">
                            {it.href ? (
                              <a href={it.href} target="_blank" rel="noreferrer" className="font-semibold text-storm underline decoration-line-subtle underline-offset-2 transition-colors duration-200 hover:text-teal-deep">
                                {it.label}
                              </a>
                            ) : (
                              <strong className="font-semibold text-storm">{it.label}</strong>
                            )}{" "}
                            {it.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
