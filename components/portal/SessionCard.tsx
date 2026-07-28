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

type RecapBlock =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "callout"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "para"; lines: string[] };

function wholeLineHeading(t: string): string | null {
  let s = t.trim();
  const bold = s.match(/^\*\*([\s\S]+)\*\*$/);
  if (bold) s = bold[1].trim();
  const und = s.match(/^__([\s\S]+)__$/);
  if (und) {
    let inner = und[1].trim();
    const ib = inner.match(/^\*\*([\s\S]+)\*\*$/);
    if (ib) inner = ib[1].trim();
    if (inner.includes("__")) return null;
    return inner;
  }
  return null;
}

function parseRecapBlocks(src: string): RecapBlock[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: RecapBlock[] = [];
  let para: string[] = [];
  let sawBlank = false;
  const flushPara = () => { if (para.length) { blocks.push({ kind: "para", lines: para }); para = []; } };
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "") { flushPara(); sawBlank = true; continue; }
    const headText = wholeLineHeading(t);
    if (t.startsWith("##")) { flushPara(); blocks.push({ kind: "h2", text: t.replace(/^##\s*/, "") }); }
    else if (t.startsWith("#")) { flushPara(); blocks.push({ kind: "h1", text: t.replace(/^#\s*/, "") }); }
    else if (headText) { flushPara(); blocks.push({ kind: "h1", text: headText }); }
    else if (/^>\s?/.test(t)) {
      flushPara();
      const body = t.replace(/^>\s?/, "");
      const prev = blocks[blocks.length - 1];
      if (!sawBlank && prev && prev.kind === "callout") prev.lines.push(body);
      else blocks.push({ kind: "callout", lines: [body] });
    } else if (/^(?:[-\u2022\*])\s+/.test(t)) {
      flushPara();
      const body = t.replace(/^(?:[-\u2022\*])\s+/, "");
      const prev = blocks[blocks.length - 1];
      if (!sawBlank && prev && prev.kind === "list") prev.items.push(body);
      else blocks.push({ kind: "list", items: [body] });
    } else {
      para.push(raw);
    }
    sawBlank = false;
  }
  flushPara();
  return blocks;
}

function richRecap(text: string) {
  return parseRecapBlocks(text).map((b, i) => {
    if (b.kind === "h1")
      return <h4 key={i} className="mb-2 mt-6 first:mt-0 font-condensed text-[13px] font-bold uppercase tracking-label text-gold-deep">{everestInline(b.text)}</h4>;
    if (b.kind === "h2")
      return <h5 key={i} className="mb-1.5 mt-5 first:mt-0 font-condensed text-[13.5px] font-bold uppercase tracking-label text-storm">{everestInline(b.text)}</h5>;
    if (b.kind === "callout")
      return (
        <div key={i} className="my-4 first:mt-0 rounded-r-md border-l-[3px] border-gold bg-gold/[0.08] px-4 py-3 text-[14px] leading-[1.6] text-storm">
          {b.lines.map((ln, j) => <span key={j} className="block">{everestInline(ln)}</span>)}
        </div>
      );
    if (b.kind === "list")
      return (
        <ul key={i} className="my-3 first:mt-0 flex flex-col gap-2">
          {b.items.map((it, j) => (
            <li key={j} className="flex gap-2.5">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-gold" />
              <span className="flex-1">{everestInline(it)}</span>
            </li>
          ))}
        </ul>
      );
    return (
      <p key={i} className="my-3 first:mt-0">
        {b.lines.map((ln, j) => <span key={j} className="block">{everestInline(ln)}</span>)}
      </p>
    );
  });
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
          <div className="max-w-[68ch] text-[14px] leading-[1.75] text-ink">
            {session.recap ? richRecap(session.recap) : <p className="text-slate-50">Recap posts here after the session.</p>}
          </div>
          {Array.isArray((session as any).photos) && (session as any).photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {(session as any).photos.map((ph: string, i: number) => (
                <a key={i} href={ph} target="_blank" rel="noreferrer">
                  <img src={ph} alt={`Session photo ${i + 1}`} className="h-36 w-56 rounded-lg border border-line-subtle object-cover shadow-sm transition-transform hover:scale-[1.03]" />
                </a>
              ))}
            </div>
          )}
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
