"use client";

import * as React from "react";
import type { JourneyPhase } from "./types";
import SectionHeading from "./SectionHeading";
import JourneyMap from "./JourneyMap";
import PhaseDetail from "./PhaseDetail";
import LockedTeaserCard from "./LockedTeaserCard";
import { LockIcon } from "./icons";

/**
 * JourneyView — the full dark journey screen: heading, dot map, an optional
 * "locked" toast, the selected PhaseDetail, and the future locked-teaser grid.
 */
export interface JourneyViewProps {
  phases: JourneyPhase[];
  lockedTeasers: { num: string; name: string; teaser: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function JourneyView({
  phases,
  lockedTeasers,
  selectedIndex,
  onSelect,
}: JourneyViewProps) {
  const [lockMsg, setLockMsg] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showLock = () => {
    setLockMsg(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLockMsg(false), 3500);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const currentIndex = Math.max(0, phases.findIndex((p) => p.state === "current"));
  const selected = phases[selectedIndex] ?? phases[currentIndex];

  return (
    <div className="animate-fade-up">
      <section className="box-border min-h-[calc(100vh-120px)] bg-granite px-9 pb-[72px] pt-14">
        <div className="flex max-w-[1080px] flex-col gap-11">
          <SectionHeading
            onDark
            eyebrow="The Route"
            title="Your engagement journey"
            lead="Checkpoint by checkpoint. The current phase is live now; later checkpoints unlock as the work progresses."
          />

          <JourneyMap
            phases={phases}
            selectedIndex={selectedIndex}
            currentIndex={currentIndex}
            onSelect={onSelect}
            onLockedClick={showLock}
          />

          {lockMsg && (
            <div className="flex animate-fade-up items-center gap-3 self-center rounded border border-ondark/20 bg-white/[0.08] px-[18px] py-3">
              <LockIcon size={13} className="text-gold" />
              <span className="text-[13.5px] text-snow">
                This section is locked for now. Either we haven&rsquo;t reached this point yet, or you don&rsquo;t currently have access to this section.
              </span>
            </div>
          )}

          {selected ? (
            <div key={selected.num} className="animate-fade-up">
              <PhaseDetail phase={selected} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border-regular border-dashed border-ondark/25 px-8 py-14 text-center">
              <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-ondark/50">
                Route not mapped yet
              </span>
              <span className="max-w-[46ch] text-[14px] leading-relaxed text-ondark-muted">
                The journey for this engagement hasn&rsquo;t been laid out yet. Your Everest team will
                add the phases as the partnership takes shape.
              </span>
            </div>
          )}

          {lockedTeasers.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-ondark/50">
                Further up the mountain
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
                {lockedTeasers.map((t, i) => (
                  <div key={t.num} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}>
                    <LockedTeaserCard
                      num={t.num}
                      name={t.name}
                      teaser={t.teaser}
                      onClick={showLock}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
