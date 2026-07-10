"use client";

import * as React from "react";
import type { JourneyPhase } from "./types";
import { phaseChipClasses } from "./helpers";
import { LockIcon } from "./icons";

/**
 * JourneyMap — the dot-by-dot route tracker on the dark expedition map.
 * Available + current dots are clickable; locked dots fire `onLockedClick`
 * (surface the "locked until the period progresses" message).
 */
export interface JourneyMapProps {
  phases: JourneyPhase[];
  selectedIndex: number;
  currentIndex: number;      // drives the connector line "progress"
  onSelect: (index: number) => void;
  onLockedClick: () => void;
}

export default function JourneyMap({
  phases,
  selectedIndex,
  currentIndex,
  onSelect,
  onLockedClick,
}: JourneyMapProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-0">
      {phases.map((phase, i) => {
        const locked = phase.state === "locked";
        const current = phase.state === "current";
        const selected = i === selectedIndex;

        const dotBorder = current ? "border-gold" : locked ? "border-ondark/[0.28]" : "border-teal";
        const dotFill = current ? "bg-gold" : locked ? "bg-transparent" : "bg-teal";
        const ring = selected
          ? current
            ? "shadow-[0_0_0_5px_rgba(251,173,24,0.25)]"
            : "shadow-[0_0_0_5px_rgba(108,202,208,0.25)]"
          : "";
        const numColor = current ? "text-gold" : locked ? "text-ondark/40" : "text-teal";
        const nameColor = locked ? "text-ondark/50" : "text-snow";

        const leftLine =
          i === 0 ? "bg-transparent" : i <= currentIndex ? "bg-teal/90" : "bg-white/[0.18]";
        const rightLine =
          i === phases.length - 1 ? "bg-transparent" : i < currentIndex ? "bg-teal/90" : "bg-white/[0.18]";

        const handle = () => (locked ? onLockedClick() : onSelect(i));

        return (
          <div key={phase.num} className="flex flex-col px-1">
            {/* connector + dot */}
            <div className="flex h-[30px] items-center">
              <div className={["h-0.5 flex-1", leftLine].join(" ")} />
              <button
                onClick={handle}
                aria-label={phase.name}
                className={[
                  "mx-1 h-4 w-4 flex-none rounded-full border-[3px] box-border cursor-pointer p-0 transition-[box-shadow,transform] duration-[280ms] ease-climb hover:scale-125",
                  dotBorder,
                  dotFill,
                  ring,
                ].join(" ")}
              />
              <div className={["h-0.5 flex-1", rightLine].join(" ")} />
            </div>

            {/* label */}
            <button
              onClick={handle}
              className="flex flex-col items-center gap-[7px] px-1.5 pt-4 text-center"
            >
              <span className={["font-condensed text-[12px] font-bold uppercase tracking-[0.16em]", numColor].join(" ")}>
                {phase.num}
              </span>
              <span className={["font-display text-[15.5px] uppercase leading-[1.1] tracking-display", nameColor].join(" ")}>
                {phase.name}
              </span>
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label",
                  phaseChipClasses(phase.state),
                ].join(" ")}
              >
                {locked && <LockIcon />}
                <span>{current ? "Current Phase" : locked ? "Locked" : "Available"}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
