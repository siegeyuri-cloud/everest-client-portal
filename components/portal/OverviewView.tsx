import * as React from "react";
import type { BuildItem, CurrentFocus } from "./types";
import SectionHeading from "./SectionHeading";

/**
 * OverviewView — the landing screen after sign-in:
 *   1. Dark topographic hero (org name + situation copy)
 *   2. Current Focus card (phase / next step / owner / due + progress)
 *   3. "What we're building" deliverable grid
 *   4. Photo + closing strip
 */
export interface OverviewViewProps {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    paragraphs: string[];
    closingLead: string;
    closingAside: string;
  };
  focus: CurrentFocus;
  buildItems: BuildItem[];
  teamPhoto: string;          // {teamPhoto}
  onViewJourney?: () => void;
}

export default function OverviewView({
  hero,
  focus,
  buildItems,
  teamPhoto,
  onViewJourney,
}: OverviewViewProps) {
  return (
    <div className="animate-fade-up">
      {/* 1. Hero */}
      <section className="bg-topo px-9 pb-[52px] pt-12">
        <div className="flex max-w-[1080px] flex-col gap-3.5">
          <div className="font-condensed text-[14px] font-bold uppercase tracking-eyebrow text-gold">
            {hero.eyebrow}
          </div>
          <h1 className="font-display text-[clamp(30px,4vw,50px)] uppercase leading-[1.04] tracking-display text-snow">
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
          <div className="text-[16px] italic leading-[1.6] text-gold-50">{hero.subtitle}</div>
          {hero.paragraphs.map((p, i) => (
            <p key={i} className="max-w-[110ch] text-[15px] leading-relaxed text-ondark-muted">
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* 2. Current Focus */}
      <section className="px-9 pt-9">
        <div className="max-w-[1080px] overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-md">
          <div className="h-1 bg-gold" />
          <div className="flex flex-col gap-7 px-9 pb-9 pt-8">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
              <FocusCell label="Current Phase" display>{focus.phase}</FocusCell>
              <FocusCell label="Next Step">{focus.nextStep}</FocusCell>
              <FocusCell label="Owner">{focus.owner}</FocusCell>
              <FocusCell label="Due">{focus.due}</FocusCell>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between font-condensed text-[12px] font-bold uppercase tracking-wide text-slate-50">
                <span>Setup</span>
                <span>Discovery</span>
                <span>Readout</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-sunken">
                <div
                  className="h-full rounded bg-gradient-to-r from-teal to-gold transition-[width] duration-[420ms] ease-climb"
                  style={{ width: `${focus.progressPct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-[13px] text-slate-75">{focus.progressLabel}</div>
                <button
                  onClick={onViewJourney}
                  className="font-condensed text-[12px] font-bold uppercase tracking-label text-teal-deep"
                >
                  View the full journey →
                </button>
              </div>
            </div>

            <div className="max-w-[76ch] border-t border-line-subtle pt-[18px] text-[13.5px] leading-relaxed text-slate-75">
              {focus.context}
            </div>
          </div>
        </div>
      </section>

      {/* 3. What we're building */}
      <section className="px-9 pb-6 pt-12">
        <div className="flex max-w-[1080px] flex-col gap-7">
          <SectionHeading eyebrow="The Work" title="What we're building for you" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
            {buildItems.map((item, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-md border border-line-subtle bg-paper px-6 pb-[22px] pt-6 shadow-sm transition-[transform,box-shadow] duration-[320ms] ease-climb hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="h-[3px] w-7 bg-teal" />
                <div className="font-condensed text-[15px] font-bold uppercase tracking-label text-storm">
                  {item.title}
                </div>
                <div className="text-[13.5px] leading-[1.65] text-slate-75">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Photo + closing */}
      <section className="px-9 pb-16 pt-6">
        <div className="grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-10">
          <div className="relative min-h-[260px] overflow-hidden rounded-lg shadow-image">
            <img
              src={teamPhoto}
              alt="Leadership team in a working session"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-[3px] w-[34px] bg-gold" />
            <p className="max-w-[56ch] text-[15.5px] font-medium leading-relaxed text-storm">
              {hero.closingLead}
            </p>
            <p className="max-w-[56ch] text-[14.5px] italic leading-relaxed text-slate-75">
              {hero.closingAside}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function FocusCell({
  label,
  children,
  display = false,
}: {
  label: string;
  children: React.ReactNode;
  display?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-condensed text-[12px] font-bold uppercase tracking-wide text-slate-50">
        {label}
      </div>
      {display ? (
        <div className="font-display text-[22px] uppercase leading-[1.1] tracking-display text-storm">
          {children}
        </div>
      ) : (
        <div className="text-[14.5px] font-medium leading-snug text-storm">{children}</div>
      )}
    </div>
  );
}
