import * as React from "react";
import type { Session } from "./types";
import { statusBadgeClasses, sessionNumberClass } from "./helpers";

/**
 * SessionCard — one working session row: big numeral, title + objective +
 * resources link, and a status badge with date.
 */
export interface SessionCardProps {
  // expanded recap lives in session.recap when provided
  session: Session;
  onOpenResources?: () => void;
  onViewKeyItems?: () => void;
  onViewRecordings?: (num: string) => void;
}


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

function richRecap(text: string) {
  return text.split(/\n\s*\n/).map((para, i) => (
    <span key={i} className={"block" + (i > 0 ? " mt-3" : "")}>
      {para.split("\n").map((ln, j) => everestLine(ln, j))}
    </span>
  ));
}

export default function SessionCard({ session, onOpenResources, onViewKeyItems, onViewRecordings }: SessionCardProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border border-line-subtle bg-paper shadow-sm transition-[transform,box-shadow,border-color] duration-[320ms] ease-climb hover:-translate-y-[3px] hover:border-line hover:shadow-lift">
      <button onClick={() => setOpen((v) => !v)} className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-6 px-7 py-6 text-left">
        <div className={["font-display text-[30px] uppercase", sessionNumberClass(session.status)].join(" ")}>
          {session.num}
        </div>
        <div className="flex min-w-[220px] flex-col gap-1.5">
          <div className="font-condensed text-[16px] font-bold uppercase tracking-label text-storm">{session.title}</div>
          <div className="text-[14px] leading-[1.6] text-slate-75">{session.objective}</div>
          <span className="font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep">{open ? "Close" : "Expand"}</span>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <span className={["rounded px-3 py-[5px] font-condensed text-[11px] font-bold uppercase tracking-label", statusBadgeClasses(session.status)].join(" ")}>
            {session.status}
          </span>
          <span className="text-[13px] text-slate-50">{session.date}</span>
        </div>
      </button>
      {open && (
        <div className="animate-fade-up border-t border-line-subtle px-7 py-5">
          <p className="text-[14px] leading-[1.7] text-slate-75">
            {session.recap ? richRecap(session.recap) : "Recap posts here after the session."}
            {Array.isArray((session as any).photos) && (session as any).photos.length > 0 && (
              <span className="mt-4 flex flex-wrap gap-3">
                {(session as any).photos.map((ph: string, i: number) => (
                  <a key={i} href={ph} target="_blank" rel="noreferrer">
                    <img src={ph} alt={`Session photo ${i + 1}`} className="h-36 w-56 rounded-lg border border-line-subtle object-cover shadow-sm transition-transform hover:scale-[1.03]" />
                  </a>
                ))}
              </span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {session.hasRecording ? (
              <button
                onClick={() => onViewRecordings?.(session.num)}
                className="font-condensed text-[12px] font-bold uppercase tracking-label text-teal-deep transition-colors duration-200 ease-climb hover:text-teal"
              >
                View recording →
              </button>
            ) : (
              <span className="font-condensed text-[12px] font-bold uppercase tracking-label text-slate-50">
                No recording for this one
              </span>
            )}
            {!!session.actionItemCount && (
              <button
                onClick={onViewKeyItems}
                className="font-condensed text-[12px] font-bold uppercase tracking-label text-gold-deep transition-colors duration-200 ease-climb hover:text-gold"
              >
                View action items ({session.actionItemCount}) →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
