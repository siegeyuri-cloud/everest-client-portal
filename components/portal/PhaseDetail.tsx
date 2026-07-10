import * as React from "react";
import type { JourneyPhase } from "./types";

/**
 * PhaseDetail — the expanded card for the selected journey phase.
 * Renders whatever the phase carries: kicker, priced investment block,
 * paragraphs (with optional bold leads), a "What's Included" grid, and a close line.
 */
export interface PhaseDetailProps {
  phase: JourneyPhase;
}


/** Tiny inline formatter: **bold**, *italic*, __underline__ — admin-authored, no HTML injection. */
function everestInline(text: string, depth = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*\*[^*\n]+\*\*\*|\*\*(?:[^*\n]|\*(?!\*))+?\*\*|__(?:[^_\n]|_(?!_))+?__|\*[^\s*][^*\n]*?\*)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  const rec = (t: string) => (depth < 3 ? everestInline(t, depth + 1) : [t]);
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("***")) parts.push(<strong key={k++} className="font-bold text-storm"><em>{tok.slice(3, -3)}</em></strong>);
    else if (tok.startsWith("**")) parts.push(<strong key={k++} className="font-bold text-storm">{rec(tok.slice(2, -2))}</strong>);
    else if (tok.startsWith("__")) parts.push(<u key={k++}>{rec(tok.slice(2, -2))}</u>);
    else parts.push(<em key={k++}>{rec(tok.slice(1, -1))}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function everestLine(ln: string, key: React.Key): React.ReactNode {
  const bullet = ln.match(/^\s*(?:[-\u2022\*])\s+(.*)$/);
  if (bullet) {
    return (
      <span key={key} className="flex gap-2 pl-1">
        <span className="select-none text-gold">{"\u2022"}</span>
        <span className="flex-1">{everestInline(bullet[1])}</span>
      </span>
    );
  }
  return <span key={key} className="block">{everestInline(ln)}</span>;
}

function renderInline(text: string): React.ReactNode[] {
  // lines render individually so "- " and "* " bullets work everywhere
  return text.split("\n").map((ln, i) => everestLine(ln, i));
}

export default function PhaseDetail({ phase }: PhaseDetailProps) {
  const isCurrent = phase.state === "current";
  const barColor = isCurrent ? "bg-gold" : "bg-teal";
  const numColor = isCurrent ? "text-gold-deep" : "text-teal-deep";
  const badgeClasses = isCurrent ? "bg-gold-50 text-storm" : "bg-teal-50 text-storm";
  const badgeLabel = isCurrent ? "Current Phase" : "Available";

  return (
    <div className="overflow-hidden rounded-lg bg-paper shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className={["h-1", barColor].join(" ")} />
      <div className="flex flex-col gap-[22px] px-10 pb-10 pt-9">
        {phase.kicker && (
          <div className="-mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-gold-deep">
            {phase.kicker}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-4">
            <span className={["font-display text-[34px] leading-none", numColor].join(" ")}>
              {phase.num}
            </span>
            <span className="font-display text-[24px] uppercase leading-[1.1] tracking-display text-storm">
              {phase.name}
            </span>
          </div>
          <span
            className={[
              "rounded px-3 py-[5px] font-condensed text-[11px] font-bold uppercase tracking-label",
              badgeClasses,
            ].join(" ")}
          >
            {badgeLabel}
          </span>
        </div>

        {phase.investIntro && (
          <div className="max-w-[74ch] text-[15px] font-medium leading-relaxed text-storm">
            {phase.investIntro}
          </div>
        )}

        {phase.investment && (
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-md bg-storm px-7 py-6">
            <div className="flex flex-col gap-1">
              <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-gold">
                {phase.investment.label}
              </span>
              <span className="font-display text-[40px] uppercase leading-none text-snow">
                {phase.investment.amount}
              </span>
            </div>
            <span className="font-condensed text-[12px] uppercase tracking-wide text-ondark-muted">
              {phase.investment.caption}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          {phase.paragraphs.map((p, i) => (
            <div
              key={i}
              className="max-w-[76ch] border-l-[3px] border-teal py-0.5 pl-[18px] text-[14.5px] leading-relaxed text-ink"
            >
              {p.lead && <strong className="font-bold text-storm">{p.lead}: </strong>}
              <span>{renderInline(p.text)}</span>
            </div>
          ))}
        </div>

        {phase.deliverables && phase.deliverables.length > 0 && (
          <div className="flex flex-col gap-3.5 border-t border-line-subtle pt-[22px]">
            <div className="font-condensed text-[12px] font-bold uppercase tracking-wide text-gold-deep">
              What&rsquo;s Included
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
              {phase.deliverables.map((d) => (
                <div
                  key={d.n}
                  className="flex flex-col gap-2 rounded-md border border-line-subtle bg-snow px-[22px] py-5"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-condensed text-[13px] font-bold uppercase tracking-label text-teal-deep">
                      {d.n}
                    </span>
                    <span className="font-condensed text-[14.5px] font-bold uppercase tracking-label text-storm">
                      {d.title}
                    </span>
                  </div>
                  <div className="text-[13.5px] leading-[1.65] text-slate-75">{d.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase.closing && (
          <div className="max-w-[76ch] border-l-[3px] border-gold py-0.5 pl-[18px] text-[15px] font-medium italic leading-relaxed text-storm">
            {renderInline(phase.closing)}
          </div>
        )}
      </div>
    </div>
  );
}
