/**
 * Everest Collective — Client Portal
 * Shared TypeScript types. Every dynamic value the design renders is typed here,
 * so you can see exactly what data each component needs.
 */

export type NavKey =
  | "overview"
  | "journey"
  | "sessions"
  | "keyItems"
  | "recordings"
  | "resources"
  | "logistics"
  | "internal";

export interface NavItem {
  [key: string]: any;
  key: NavKey;
  label: string;          // {navLabel}
  count?: number;         // {openCount} — optional badge (e.g. open key items)
}

export interface NavGroup {
  [key: string]: any;
  label: string;          // {navGroupLabel} — e.g. "Engagement", "Library"
  items: NavItem[];
}

/* ---------- Journey ---------- */
export type PhaseState = "available" | "current" | "locked";

export interface PhaseParagraph {
  [key: string]: any;
  lead?: string;          // {paragraphLead} — optional bold lead-in
  text: string;           // {paragraphBody}
}

export interface Deliverable {
  [key: string]: any;
  n: string;              // {deliverableNumber} — "01"
  title: string;          // {deliverableTitle}
  body: string;           // {deliverableBody}
}

export interface JourneyPhase {
  [key: string]: any;
  num: string;            // {phaseNumber} — "01"
  name: string;           // {phaseTitle}
  kicker?: string;        // {phaseKicker} — e.g. "What We Heard"
  state: PhaseState;
  teaser: string;         // {phaseTeaser} — shown in the dot + locked cards
  paragraphs: PhaseParagraph[];
  investIntro?: string;   // {investmentIntro} — optional lead paragraph
  investment?: {          // optional priced block
    label: string;        // {investmentLabel}
    amount: string;       // {investmentAmount} — e.g. "$35,000"
    caption: string;      // {investmentCaption}
  };
  deliverables?: Deliverable[]; // optional "What's Included" grid
  closing?: string;       // {phaseClosing} — optional italic close
}

/* ---------- Overview ---------- */
export interface BuildItem {
  [key: string]: any;
  title: string;          // {buildTitle}
  body: string;           // {buildBody}
}

export interface CurrentFocus {
  [key: string]: any;
  phase: string;          // {currentPhase}
  nextStep: string;       // {nextStep}
  owner: string;          // {focusOwner}
  due: string;            // {focusDue}
  progressPct: number;    // 0–100
  progressLabel: string;  // {progressLabel}
  context: string;        // {focusContext}
}

/* ---------- Sessions ---------- */
export type SessionStatus = "Upcoming" | "In Progress" | "Complete";

export interface Session {
  [key: string]: any;
  num: string;            // {sessionNumber} — "01"
  title: string;          // {sessionTitle}
  objective: string;      // {sessionObjective}
  date: string;           // {sessionDate}
  status: SessionStatus;
  actionItemCount?: number; // key items linked to this session
  hasRecording?: boolean;  // linked recording resource exists
  recap?: string;          // shown when the card is expanded
}

/* ---------- Key items ---------- */
export type KeyItemStatus = "Not Started" | "In Progress" | "Complete";

export interface KeyItem {
  [key: string]: any;
  perUser?: boolean;      // each member checks their own copy
  id: string;
  label: string;          // {keyItemLabel}
  category: string;       // {keyItemCategory} — e.g. "Legal / Onboarding"
  status: KeyItemStatus;
  required?: boolean;
  done: boolean;
  docKey?: string;        // present → shows a "Review document" action
}

/* ---------- Resources (accordion) ---------- */
export interface ResourceBullet {
  [key: string]: any;
  tone: "teal" | "gold";  // peak-bullet color
  label: string;          // {resourceItemLabel} — bold lead
  detail: string;         // {resourceItemDetail}
}

export interface ResourceSection {
  [key: string]: any;
  num: string;            // {resourceNumber} — "01"
  title: string;          // {resourceTitle}
  intro: string;          // {resourceIntro}
  items: ResourceBullet[];
}

/* ---------- Logistics ---------- */
export interface LogisticsField {
  [key: string]: any;
  label: string;          // {logisticsLabel}
  value: string;          // {logisticsValue}
}

/* ---------- Recordings ---------- */
export interface Recording {
  [key: string]: any;
  num?: string;           // matches session num for exact jumps
  title: string;          // {recordingTitle}
  url?: string;           // Fathom link
  transcriptUrl?: string; // provided by Everest
  note: string;           // {recordingNote}
  duration: string;       // {recordingDuration} — "52 min" or "—"
  available: boolean;     // true → play button + links
  lockNote?: string;      // {recordingLockNote} — shown when not available
  hasThumb?: boolean;     // true → uses {teamPhoto}, else topo texture
}

/* ---------- Internal notes ---------- */
export interface InternalNote {
  [key: string]: any;
  label: string;          // {noteLabel}
  value: string;          // {noteValue}
}

/* ---------- Document (review modal) ---------- */
export interface PortalDoc {
  [key: string]: any;
  key: string;
  title: string;          // {docTitle}
  pdfUrl: string;         // {docPdfUrl}
}

/* ---------- Identity ---------- */
export interface PortalIdentity {
  [key: string]: any;
  orgName: string;        // {orgName}
  workspaceLabel: string; // {workspaceLabel} — e.g. "Partnership Workspace"
  portalUrl: string;      // {portalUrl} — clients.everestcollective.com/{orgSlug}
  engagementType: string; // {engagementType}
  status: string;         // {statusLabel} — e.g. "In Progress"
  lastUpdated: string;    // {lastUpdated}
  userName: string;       // {userName}
  userMeta: string;       // {userMeta}
  logoUrl: string;        // {logoWhiteUrl}
}
