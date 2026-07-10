import type { SessionStatus, KeyItemStatus, PhaseState } from "./types";

/**
 * Status → Tailwind class maps. Keeps badge / marker colors identical
 * everywhere they appear (sessions, key items, journey dots).
 */

export function statusBadgeClasses(status: SessionStatus | KeyItemStatus): string {
  switch (status) {
    case "Complete":
      return "text-storm bg-teal-50";
    case "In Progress":
      return "text-storm bg-gold-50";
    default: // "Upcoming" | "Not Started"
      return "text-slate-75 bg-mist";
  }
}

/** Big display numeral color for a session, by status. */
export function sessionNumberClass(status: SessionStatus): string {
  if (status === "Upcoming") return "text-slate-25";
  if (status === "In Progress") return "text-gold-deep";
  return "text-teal-deep";
}

/** Journey dot chip (Current / Available / Locked) on the dark map. */
export function phaseChipClasses(state: PhaseState): string {
  if (state === "current") return "bg-gold text-storm";
  if (state === "locked") return "bg-white/[0.08] text-ondark/60";
  return "bg-teal/[0.14] text-teal";
}

/** Checkbox border color for a key item. */
export function checkboxBorderClass(status: KeyItemStatus, done: boolean): string {
  if (done) return "border-teal bg-teal";
  if (status === "In Progress") return "border-gold";
  return "border-slate-25";
}
