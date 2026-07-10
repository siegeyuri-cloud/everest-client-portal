import * as React from "react";
import type { Session } from "./types";
import SectionHeading from "./SectionHeading";
import SessionCard from "./SessionCard";

/**
 * SessionsView — the working-sessions screen: heading + a stack of SessionCards.
 */
export interface SessionsViewProps {
  sessions: Session[];
  onOpenResources?: () => void;
  onViewKeyItems?: () => void;
  onViewRecordings?: (num: string) => void;
}

export default function SessionsView({ sessions, onOpenResources, onViewKeyItems, onViewRecordings }: SessionsViewProps) {
  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <SectionHeading
          eyebrow="The Climb"
          title="Working sessions"
          lead="Each session builds on the last, and the notes live in this workspace."
        />
        <div className="flex flex-col gap-3.5">
          {sessions.map((s) => (
            <SessionCard key={s.num} session={s} onOpenResources={onOpenResources} onViewKeyItems={onViewKeyItems} onViewRecordings={onViewRecordings} />
          ))}
        </div>
      </div>
    </div>
  );
}
