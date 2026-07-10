import type {
  PortalIdentity,
  NavGroup,
  JourneyPhase,
  BuildItem,
  CurrentFocus,
  Session,
  KeyItem,
  ResourceSection,
  LogisticsField,
  Recording,
  InternalNote,
  PortalDoc,
} from "./types";

/**
 * ────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER DATA
 *  Every value is a clearly-labeled {token}. Swap this whole file for your
 *  real data (from props, a loader, a CMS — your call) and the UI fills in.
 *  Comments show a real example so you can see the intended shape.
 * ────────────────────────────────────────────────────────────────────────
 */

export const identity: PortalIdentity = {
  orgName: "{orgName}",                 // e.g. "Southern Staffing Group"
  workspaceLabel: "{workspaceLabel}",   // e.g. "Partnership Workspace"
  portalUrl: "{portalUrl}",             // e.g. "clients.everestcollective.com/{orgSlug}"
  engagementType: "{engagementType}",   // e.g. "Discovery & Assessment Period"
  status: "{statusLabel}",              // e.g. "In Progress"
  lastUpdated: "{lastUpdated}",         // e.g. "July 9, 2026"
  userName: "{userName}",               // e.g. "SSG Leadership"
  userMeta: "{userMeta}",               // e.g. "testclient@everestcollective.com"
  logoUrl: "/assets/logo-horizontal-white.png",
};

export const navGroups: NavGroup[] = [
  {
    label: "{navGroupLabel}", // "Engagement"
    items: [
      { key: "overview", label: "{navLabel}" }, // "Overview"
      { key: "journey", label: "{navLabel}" },  // "Journey"
      { key: "sessions", label: "{navLabel}" }, // "Sessions"
      { key: "keyItems", label: "{navLabel}", count: 0 }, // "Key Items" (count = open items)
    ],
  },
  {
    label: "{navGroupLabel}", // "Library"
    items: [
      { key: "recordings", label: "{navLabel}" }, // "Recordings"
      { key: "resources", label: "{navLabel}" },  // "Resources"
      { key: "logistics", label: "{navLabel}" },  // "Logistics"
    ],
  },
  {
    label: "{navGroupLabel}", // "Everest Team"
    items: [{ key: "internal", label: "{navLabel}" }], // "Team Notes"
  },
];

/** Hero + Current Focus (Overview screen). */
export const overviewHero = {
  eyebrow: "{overviewEyebrow}",   // "Discovery & Assessment Period · Proposal 06_19_2026"
  titleLine1: "{orgName}",        // renders big; break across two lines however you like
  titleLine2: "{workspaceLabel}",
  subtitle: "{overviewSubtitle}", // italic gold line
  paragraphs: ["{overviewParagraph}", "{overviewParagraph}"],
  closingLead: "{overviewClosingLead}",   // bold-weight strip beside the photo
  closingAside: "{overviewClosingAside}", // italic under it
};

export const currentFocus: CurrentFocus = {
  phase: "{currentPhase}",         // "Discovery & Assessment Period"
  nextStep: "{nextStep}",          // "Complete leadership interviews"
  owner: "{focusOwner}",           // "Everest Collective + {orgName} Leadership"
  due: "{focusDue}",               // "Friday, July 24"
  progressPct: 42,                 // 0–100
  progressLabel: "{progressLabel}",// "Phase 2 of 6 · Discovery underway"
  context: "{focusContext}",       // one grounded paragraph
};

export const buildItems: BuildItem[] = [
  { title: "{buildTitle}", body: "{buildBody}" }, // repeat per deliverable card
  { title: "{buildTitle}", body: "{buildBody}" },
  { title: "{buildTitle}", body: "{buildBody}" },
  { title: "{buildTitle}", body: "{buildBody}" },
  { title: "{buildTitle}", body: "{buildBody}" },
  { title: "{buildTitle}", body: "{buildBody}" },
];

/**
 * JOURNEY — 6 phases. `state` drives the whole map:
 *   available → clickable, teal dot
 *   current   → highlighted, gold dot, "Current Phase" chip
 *   locked    → lock badge, blurred teaser, not selectable
 */
export const journeyPhases: JourneyPhase[] = [
  {
    num: "01",
    name: "{phaseTitle}",
    kicker: "{phaseKicker}",        // optional
    state: "available",
    teaser: "{phaseTeaser}",
    paragraphs: [{ text: "{phaseParagraph}" }],
  },
  {
    num: "02",
    name: "{phaseTitle}",
    kicker: "{phaseKicker}",
    state: "current",
    teaser: "{phaseTeaser}",
    investIntro: "{investmentIntro}",
    investment: {
      label: "{investmentLabel}",   // "Discovery Period"
      amount: "{investmentAmount}", // "$35,000"
      caption: "{investmentCaption}",
    },
    paragraphs: [{ text: "{phaseParagraph}" }],
    deliverables: [
      { n: "01", title: "{deliverableTitle}", body: "{deliverableBody}" },
      { n: "02", title: "{deliverableTitle}", body: "{deliverableBody}" },
      { n: "03", title: "{deliverableTitle}", body: "{deliverableBody}" },
      { n: "04", title: "{deliverableTitle}", body: "{deliverableBody}" },
      { n: "05", title: "{deliverableTitle}", body: "{deliverableBody}" },
    ],
    closing: "{phaseClosing}",
  },
  {
    num: "03",
    name: "{phaseTitle}",
    state: "locked",
    teaser: "{phaseTeaser}",
    paragraphs: [
      { lead: "{paragraphLead}", text: "{phaseParagraph}" },
      { lead: "{paragraphLead}", text: "{phaseParagraph}" },
    ],
  },
  {
    num: "04",
    name: "{phaseTitle}",
    state: "locked",
    teaser: "{phaseTeaser}",
    paragraphs: [{ lead: "{paragraphLead}", text: "{phaseParagraph}" }],
  },
  {
    num: "05",
    name: "{phaseTitle}",
    state: "locked",
    teaser: "{phaseTeaser}",
    paragraphs: [{ lead: "{paragraphLead}", text: "{phaseParagraph}" }],
  },
  {
    num: "06",
    name: "{phaseTitle}",
    state: "locked",
    teaser: "{phaseTeaser}",
    paragraphs: [{ text: "{phaseParagraph}" }],
  },
];

/** Imaginary future workspace sections, shown as locked teaser cards below the journey. */
export const lockedTeasers = [
  { num: "07", name: "{lockedTitle}", teaser: "{lockedTeaser}" },
  { num: "08", name: "{lockedTitle}", teaser: "{lockedTeaser}" },
  { num: "09", name: "{lockedTitle}", teaser: "{lockedTeaser}" },
  { num: "10", name: "{lockedTitle}", teaser: "{lockedTeaser}" },
];

export const sessions: Session[] = [
  { num: "01", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "Complete" },
  { num: "02", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "In Progress" },
  { num: "03", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "Upcoming" },
  { num: "04", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "Upcoming" },
  { num: "05", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "Upcoming" },
  { num: "06", title: "{sessionTitle}", objective: "{sessionObjective}", date: "{sessionDate}", status: "Upcoming" },
];

export const keyItems: KeyItem[] = [
  { id: "k1", label: "{keyItemLabel}", category: "Legal / Onboarding", status: "Not Started", required: true, done: false, docKey: "msa" },
  { id: "k2", label: "{keyItemLabel}", category: "Legal / Onboarding", status: "Not Started", required: true, done: false, docKey: "nda" },
  { id: "k3", label: "{keyItemLabel}", category: "{keyItemCategory}", status: "Complete", done: true },
  { id: "k4", label: "{keyItemLabel}", category: "{keyItemCategory}", status: "In Progress", done: false },
  { id: "k5", label: "{keyItemLabel}", category: "{keyItemCategory}", status: "In Progress", done: false },
  { id: "k6", label: "{keyItemLabel}", category: "{keyItemCategory}", status: "Not Started", done: false },
];

export const resourceSections: ResourceSection[] = [
  {
    num: "01",
    title: "{resourceTitle}",
    intro: "{resourceIntro}",
    items: [
      { tone: "teal", label: "{resourceItemLabel}", detail: "{resourceItemDetail}" },
      { tone: "gold", label: "{resourceItemLabel}", detail: "{resourceItemDetail}" },
    ],
  },
  // …repeat per accordion section
];

export const logistics: LogisticsField[] = [
  { label: "{logisticsLabel}", value: "{logisticsValue}" }, // e.g. "Kickoff Date" → "Week of July 13"
  { label: "{logisticsLabel}", value: "{logisticsValue}" },
  { label: "{logisticsLabel}", value: "{logisticsValue}" },
  { label: "{logisticsLabel}", value: "{logisticsValue}" },
];

export const recordings: Recording[] = [
  { title: "{recordingTitle}", note: "{recordingNote}", duration: "{recordingDuration}", available: true, hasThumb: true },
  { title: "{recordingTitle}", note: "{recordingNote}", duration: "—", available: false, lockNote: "{recordingLockNote}" },
];

export const internalNotes: InternalNote[] = [
  { label: "{noteLabel}", value: "{noteValue}" },
  { label: "{noteLabel}", value: "{noteValue}" },
];

export const portalDocs: Record<string, PortalDoc> = {
  msa: { key: "msa", title: "{docTitle}", pdfUrl: "/assets/msa.pdf" }, // "Master Services Agreement"
  nda: { key: "nda", title: "{docTitle}", pdfUrl: "/assets/nda.pdf" }, // "Mutual Non-Disclosure Agreement"
};

/** Photo used in the Overview strip + recording thumbnails. */
export const teamPhoto = "/assets/team-session.jpeg";
