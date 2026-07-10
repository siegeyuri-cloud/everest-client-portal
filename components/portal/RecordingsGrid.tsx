import * as React from "react";
import type { Recording } from "./types";
import SectionHeading from "./SectionHeading";
import { PlayTriangle } from "./icons";

/**
 * RecordingsGrid — video/readout cards. Available items show a play button and
 * Watch / Transcript / Highlights links; locked items show a topo texture panel
 * with a "posts later" note.
 */
export interface RecordingsGridProps {
  highlightNum?: string | null;
  recordings: Recording[];
  teamPhoto: string;   // {teamPhoto} — used when a card has hasThumb
}

export default function RecordingsGrid({ recordings, teamPhoto, highlightNum }: RecordingsGridProps) {
  const hlRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { hlRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [highlightNum]);
  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <SectionHeading
          eyebrow="The Library"
          title="Recordings + transcripts"
          lead="Calls and readouts post here within a day."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[22px]">
          {recordings.map((rec, i) => (
            <div
              key={i}
              ref={rec.num && rec.num === highlightNum ? hlRef : undefined}
              className={[
                "flex flex-col overflow-hidden rounded-lg border bg-paper shadow-sm transition-[transform,box-shadow] duration-[320ms] ease-climb hover:-translate-y-1 hover:shadow-lift",
                rec.num && rec.num === highlightNum ? "border-gold ring-2 ring-gold/50" : "border-line-subtle",
              ].join(" ")}
            >
              {/* thumb */}
              <div className="relative flex h-[170px] items-center justify-center bg-topo">
                {rec.hasThumb && (
                  <img
                    src={teamPhoto}
                    alt="Session recording"
                    className="absolute inset-0 h-full w-full object-cover opacity-85"
                  />
                )}
                {rec.available ? (
                  <div className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-gold bg-storm/85 transition-[transform,background] duration-[280ms] ease-climb hover:scale-110 hover:bg-storm/95">
                    <PlayTriangle />
                  </div>
                ) : (
                  <div className="relative rounded border border-ondark-line px-3.5 py-1.5 font-condensed text-[12px] uppercase tracking-wide text-ondark-muted">
                    {rec.lockNote}
                  </div>
                )}
                <span className="absolute bottom-2.5 right-3 rounded bg-black/60 px-2 py-[3px] font-condensed text-[11px] tracking-label text-snow">
                  {rec.duration}
                </span>
              </div>

              {/* body */}
              <div className="flex flex-col gap-2 px-[22px] pb-[22px] pt-5">
                <div className="font-condensed text-[15px] font-bold uppercase tracking-label text-storm">
                  {rec.title}
                </div>
                <div className="text-[13px] leading-[1.6] text-slate-75">{rec.note}</div>
                {rec.available && (
                  <div className="flex gap-4 pt-1">
                    {rec.url && (
                      <a href={rec.url} target="_blank" rel="noreferrer" className="font-condensed text-[12px] font-bold uppercase tracking-label text-teal-deep">
                        Watch \u2192
                      </a>
                    )}
                    {rec.transcriptUrl && (
                      <a href={rec.transcriptUrl} target="_blank" rel="noreferrer" className="font-condensed text-[12px] font-bold uppercase tracking-label text-teal-deep">
                        Transcript →
                      </a>
                    )}
                    {["Highlights"].map((l) => (
                      <a
                        key={l}
                        href="#"
                        className="font-condensed text-[12px] font-bold uppercase tracking-label text-teal-deep no-underline"
                      >
                        {l}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
