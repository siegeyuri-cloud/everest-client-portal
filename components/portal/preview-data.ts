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
 * PREVIEW DATA — realistic Southern Staffing Group content, drawn from the
 * proposal. Used only by /app/design-preview to show the ported design with
 * real copy. In Step 13 this same shape gets produced from Supabase queries,
 * so this file is also a head start on the SSG seed content.
 */

export const identity: PortalIdentity = {
  orgName: "Southern Staffing Group",
  workspaceLabel: "Partnership Workspace",
  portalUrl: "clients.everestcollective.com/southern-staffing-group",
  engagementType: "Discovery & Assessment Period",
  status: "In Progress",
  lastUpdated: "July 9, 2026",
  userName: "SSG Leadership",
  userMeta: "Southern Staffing Group",
  logoUrl: "/assets/logo-horizontal-white.png",
};

export const navGroups: NavGroup[] = [
  {
    label: "Engagement",
    items: [
      { key: "overview", label: "Overview" },
      { key: "journey", label: "Journey" },
      { key: "sessions", label: "Sessions" },
      { key: "keyItems", label: "Key Items", count: 4 },
    ],
  },
  {
    label: "Library",
    items: [
      { key: "recordings", label: "Recordings" },
      { key: "resources", label: "Resources" },
      { key: "logistics", label: "Logistics" },
    ],
  },
  {
    label: "Everest Team",
    items: [{ key: "internal", label: "Team Notes" }],
  },
];

export const overviewHero = {
  eyebrow: "Discovery & Assessment Period · Proposal 06_19_2026",
  titleLine1: "Southern Staffing Group",
  titleLine2: "Partnership Workspace",
  subtitle:
    "A living workspace for the Discovery & Assessment period with Everest Collective.",
  paragraphs: [
    "Southern Staffing Group is a recruiting business in a phase of rapid, organic growth — inbound demand is outpacing the team's capacity, and the partners believe they can reach $10M in revenue by expanding services inside existing accounts.",
    "What you asked from Everest Collective is a trusted outside perspective — a sounding board and bumpers on the bowling lane — to make confident decisions on hiring, capital allocation, structure, and goal-setting as you push toward a $5–10M business.",
  ],
  closingLead:
    "Before committing to an ongoing engagement, we begin with a structured Discovery & Assessment period — so any work we recommend is grounded in evidence.",
  closingAside:
    "This is where we both find out if there's something worth building together.",
};

export const currentFocus: CurrentFocus = {
  phase: "Discovery & Assessment Period",
  nextStep: "Complete leadership interviews",
  owner: "Everest Collective + SSG Leadership",
  due: "Week of July 21",
  progressPct: 34,
  progressLabel: "Phase 2 of 6 · Discovery underway",
  context:
    "We're observing the morning red-zone calls, interviewing stakeholders, and building a clear-eyed picture of the current state before recommending the roadmap.",
};

export const buildItems: BuildItem[] = [
  { title: "Business Diagnostic", body: "A clear-eyed assessment of your current state — operations, performance, bottlenecks, and untapped opportunities — based on data and stakeholder interviews." },
  { title: "Quantified Value Case", body: "A financial model identifying where value can be created or recovered: revenue growth, risk mitigation, and efficiency gains." },
  { title: "Prioritized Roadmap", body: "A sequenced action plan that ranks initiatives by impact and feasibility, so you know exactly what to tackle first and why." },
  { title: "Recommended Engagement Plan", body: "A proposed scope, structure, and timeline for the ongoing work." },
  { title: "Executive Readout", body: "A presentation of findings and recommendations to your leadership team, with a documented summary for your records." },
  { title: "Strategic Sounding Board", body: "An experienced advisor validating decisions on hires, capital, and growth so you stay on track." },
];

export const journeyPhases: JourneyPhase[] = [
  {
    num: "01",
    name: "Partnership Setup",
    kicker: "Basecamp",
    state: "available",
    teaser: "Agreements signed, contacts confirmed, kickoff scheduled.",
    paragraphs: [{ text: "MSA and NDA signed, leadership contacts confirmed, and the Discovery & Assessment kickoff scheduled. The foundation for everything that follows." }],
  },
  {
    num: "02",
    name: "Discovery & Assessment",
    kicker: "You Are Here",
    state: "current",
    teaser: "The structured discovery period — where we both decide if there's a fit.",
    investIntro:
      "Before committing to an ongoing engagement, we begin with a structured Discovery & Assessment period. This ensures any work we recommend is grounded in evidence.",
    investment: { label: "Discovery Period", amount: "$35,000", caption: "Aug–Oct 2026 · three installments" },
    paragraphs: [
      { text: "We approach discovery differently than most firms. For the right partner, our goal isn't just to advise from the outside — it's to become genuinely invested in the outcome." },
    ],
    deliverables: [
      { n: "01", title: "Business Diagnostic", body: "A clear-eyed assessment of your current state based on data and stakeholder interviews." },
      { n: "02", title: "Quantified Value Case", body: "A financial model identifying where value can be created or recovered." },
      { n: "03", title: "Prioritized Roadmap", body: "A sequenced action plan ranking initiatives by impact and feasibility." },
      { n: "04", title: "Recommended Engagement Plan", body: "A proposed scope, structure, and timeline for the ongoing work." },
      { n: "05", title: "Executive Readout", body: "A presentation of findings and recommendations to your leadership team." },
    ],
    closing:
      "If the fit is right, the discovery becomes the foundation for a long-term partnership — and a fee tied to the value we create, not the hours we spend.",
  },
  {
    num: "03",
    name: "Founder Bottleneck & Leadership",
    state: "locked",
    teaser: "Relieving the founder bottleneck and developing the leadership bench.",
    paragraphs: [
      { lead: "Founder bottleneck", text: "Both partners work until 10–11 PM every night; candidate review is delayed and there's no room to oversee call volume or submission quality." },
      { lead: "Leadership development", text: "Setting clear expectations, holding people accountable, and coaching — plus a process to train new hires on the Ideal Customer Profile." },
    ],
  },
  {
    num: "04",
    name: "Scoreboard & Operating Rhythm",
    state: "locked",
    teaser: "Simple, actually-used scoreboards linking daily activity to outcomes.",
    paragraphs: [{ lead: "Practical scoreboards", text: "Linking daily activity to weekly and monthly outcomes on a clear daily-track / weekly-review cadence." }],
  },
  {
    num: "05",
    name: "Growth Strategy & Value Case",
    state: "locked",
    teaser: "Deeply penetrate two or three major accounts rather than chase new logos.",
    paragraphs: [{ lead: "Structured goal-setting", text: "Set the $5M goal, work backward into two to three priorities, define daily drivers, track against a scoreboard — then repeat for $10M." }],
  },
  {
    num: "06",
    name: "Prioritized Roadmap & Readout",
    state: "locked",
    teaser: "The executive readout — where we decide whether to keep building together.",
    paragraphs: [{ text: "A presentation of findings and recommendations to leadership, with a documented summary — and the decision on the ongoing partnership." }],
  },
];

export const lockedTeasers = [
  { num: "07", name: "Ongoing Partnership", teaser: "Scope, structure, and terms for the long-term engagement." },
  { num: "08", name: "Value-Based Engagement", teaser: "A fee tied to the value created, not the hours spent." },
];

export const sessions: Session[] = [
  { num: "01", title: "Discovery & Assessment Kickoff", objective: "Confirm scope, leadership contacts, starting materials, and expectations for the Discovery & Assessment period.", date: "July 7, 2026", status: "Complete" },
  { num: "02", title: "Red Zone Call Observation", objective: "Observe the morning red-zone calls to spot efficiency gains across 60+ active candidates.", date: "July 2026", status: "In Progress" },
  { num: "03", title: "Stakeholder Interviews", objective: "One-on-one interviews with leadership and key team members.", date: "Aug 2026", status: "Upcoming" },
  { num: "04", title: "Executive Readout", objective: "Present findings, the value case, and the prioritized roadmap to leadership.", date: "Oct 2026", status: "Upcoming" },
];

export const keyItems: KeyItem[] = [
  { id: "k1", label: "Signed MSA", category: "Legal / Onboarding", status: "Complete", required: true, done: true, docKey: "msa" },
  { id: "k2", label: "Signed NDA", category: "Legal / Onboarding", status: "Complete", required: true, done: true, docKey: "nda" },
  { id: "k3", label: "Confirm leadership contacts", category: "Setup", status: "Complete", done: true },
  { id: "k4", label: "Confirm Discovery & Assessment kickoff", category: "Setup", status: "Complete", done: true },
  { id: "k5", label: "Share relevant business context and documents", category: "Discovery", status: "In Progress", done: false },
  { id: "k6", label: "Schedule stakeholder interviews", category: "Discovery", status: "In Progress", done: false },
  { id: "k7", label: "Upload current scoreboards / reporting", category: "Discovery", status: "Not Started", done: false },
  { id: "k8", label: "Prepare executive readout materials", category: "Readout", status: "Not Started", done: false },
];

export const resourceSections: ResourceSection[] = [
  {
    num: "01",
    title: "Signed Agreements",
    intro: "Executed legal documents for this engagement. Visible to executives and the Everest team.",
    items: [
      { tone: "teal", label: "Master Services Agreement", detail: "— signed July 2, 2026." },
      { tone: "gold", label: "Mutual NDA", detail: "— signed July 2, 2026." },
    ],
  },
  {
    num: "02",
    title: "Discovery & Assessment Materials",
    intro: "Working documents gathered and produced during the discovery period.",
    items: [
      { tone: "teal", label: "Interview prep & questions", detail: "— stakeholder interview guides." },
      { tone: "gold", label: "Business context docs", detail: "— shared by SSG leadership." },
    ],
  },
  {
    num: "03",
    title: "Scoreboards & Metrics",
    intro: "Current reporting and the scoreboard work as it develops.",
    items: [
      { tone: "teal", label: "Current reporting", detail: "— existing scoreboards and dashboards." },
    ],
  },
];

export const logistics: LogisticsField[] = [
  { label: "Engagement", value: "Discovery & Assessment Period" },
  { label: "Duration", value: "August – October 2026 (~3 months)" },
  { label: "Investment", value: "$35,000 · three installments" },
  { label: "Everest Team", value: "Mike Fromhold, Brittany Tipton" },
  { label: "Kickoff", value: "July 7, 2026 · in person" },
  { label: "Executive Readout", value: "End of October 2026" },
];

export const recordings: Recording[] = [
  { title: "Discovery & Assessment Kickoff", note: "The in-person kickoff — scope, contacts, and expectations.", duration: "—", available: true, hasThumb: true },
  { title: "Executive Readout", note: "Posts after the October leadership readout.", duration: "—", available: false, lockNote: "Posts after the session" },
];

export const internalNotes: InternalNote[] = [
  { label: "Interview cautions", value: "Interviews are confidential — never expose to the executive or staff views. Admin-only." },
  { label: "Cash-flow note", value: "Fee split into three installments (Aug $10k / Sep $10k / Oct $15k) to support cash flow." },
];

export const portalDocs: Record<string, PortalDoc> = {
  msa: { key: "msa", title: "Master Services Agreement", pdfUrl: "/assets/msa.pdf" },
  nda: { key: "nda", title: "Mutual Non-Disclosure Agreement", pdfUrl: "/assets/nda.pdf" },
};

export const teamPhoto = "/assets/team-session.jpeg";
