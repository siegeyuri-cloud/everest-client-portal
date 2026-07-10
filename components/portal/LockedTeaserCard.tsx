import * as React from "react";
import { LockIcon } from "./icons";

/**
 * LockedTeaserCard — a future workspace section shown as a dashed, blurred
 * teaser on the dark journey map. Clicking it surfaces the locked message.
 */
export interface LockedTeaserCardProps {
  num: string;       // {lockedNumber}
  name: string;      // {lockedTitle}
  teaser: string;    // {lockedTeaser}
  onClick?: () => void;
}

export default function LockedTeaserCard({ num, name, teaser, onClick }: LockedTeaserCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border-regular border-dashed border-ondark/25 px-6 pb-[22px] pt-6 transition-colors duration-[280ms] ease-climb hover:border-ondark/45"
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-ondark/50">
          {num}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded bg-white/[0.08] px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-ondark/60">
          <LockIcon />
          <span>Locked</span>
        </span>
      </div>
      <div className="font-display text-[17px] uppercase leading-snug tracking-display text-ondark/75">
        {name}
      </div>
      <div className="line-clamp-3 min-h-[60px] text-[12.5px] leading-[1.6] text-ondark/55">{teaser}</div>
      {/* blurred "content" hint */}
      <div className="flex flex-col gap-[7px] pt-1">
        <div className="h-2 w-[88%] rounded-sm bg-white/[0.16] blur-[3px]" />
        <div className="h-2 w-[72%] rounded-sm bg-white/[0.13] blur-[3px]" />
        <div className="h-2 w-[55%] rounded-sm bg-white/10 blur-[3px]" />
      </div>
    </div>
  );
}
