/**
 * The registration wizard's data layer, lifted from the original
 * prototype so the React build starts from a spec rather than from
 * archaeology in a 22KB bundle.
 *
 * The field copy is the client's, written deliberately. "So the badge
 * does not say Robert on a man everyone calls Bob" is the kind of line
 * that does not survive a rewrite from memory, so it is preserved
 * verbatim here.
 *
 * What is NOT here, on purpose: the tier list and the FAQ list. Those
 * were hardcoded in the prototype with twelve invented sponsor
 * companies and a seat count of 204 that nobody had checked. They live
 * in gala_tiers and gala_faqs now, and the wizard reads them from
 * there. Copying them back into code would undo the point of 0013.
 */

export type Field = {
  name: string;
  label: string;
  ph: string;
  req: boolean;
  hint?: string;
};

/** The four doors, and the step sequence behind each. */
export const DOORS: Record<string, { label: string; steps: string[] }> = {
  guest: { label: "Invited guest", steps: ["code", "you", "connect", "review"] },
  seat: { label: "Individual seat", steps: ["seats", "you", "guest", "connect", "review", "pay"] },
  host: { label: "Table host", steps: ["table", "you", "connect", "roster", "review", "pay"] },
  sponsor: {
    label: "Corporate sponsor",
    steps: ["tier", "company", "you", "review"],
  },
};

export type Door = keyof typeof DOORS;

/** The registrant, in two column widths. */
export const YOU_HALF: Field[] = [
  { name: "first", label: "First name", ph: "David", req: true },
  { name: "last", label: "Last name", ph: "Chen", req: true },
  { name: "mobile", label: "Mobile", ph: "(214) 555 0134", req: true },
  { name: "email", label: "Email", ph: "you@company.com", req: true },
];

// Sponsors are the only door left in this form (Mike, Sept 23), and
// Reign gathers badge, dietary and access details when she follows up.
export const YOU_FULL: Field[] = [];

/**
 * The plus-one. Their own mobile and their own email, deliberately,
 * because that is what stops a spouse guessing at the hour-without-notes
 * answer at a red light.
 */
export const GUEST_HALF: Field[] = [
  { name: "gFirst", label: "Guest first name", ph: "Sarah", req: true },
  { name: "gLast", label: "Guest last name", ph: "Whitmore", req: true },
  { name: "gMobile", label: "Guest mobile", ph: "Required", req: true },
  { name: "gEmail", label: "Guest email", ph: "Required", req: true },
];

export const GUEST_FULL: Field[] = [
  { name: "gBadge", label: "Guest preferred name for badge", ph: "Optional", req: false },
  { name: "gDietary", label: "Guest dietary needs", ph: "Optional", req: false },
  { name: "gAccess", label: "Guest accessibility needs", ph: "Optional", req: false },
];

export const COMPANY_FIELDS: Field[] = [
  { name: "coLegal", label: "Company legal name", ph: "Whitmore Land & Cattle LLC", req: true },
  {
    name: "coRecog",
    label: "Name as it should appear in recognition",
    ph: "Whitmore Land & Cattle",
    req: true,
    hint: "This is what goes on the program, the screen, and the sponsor wall.",
  },
  { name: "coWeb", label: "Website", ph: "Optional", req: false },
];

/** Maps a wizard field name to the column the register API expects. */
export const FIELD_TO_API: Record<string, string> = {
  first: "first_name",
  last: "last_name",
  mobile: "mobile",
  email: "email",
  badge: "badge_name",
  dietary: "dietary",
  access: "accessibility",
  seatNear: "seat_near",
  line: "line",
  code: "code",
  tableName: "table_name",
};

/** The same, for the plus-one, which the API takes nested under plus_one. */
export const GUEST_FIELD_TO_API: Record<string, string> = {
  gFirst: "first_name",
  gLast: "last_name",
  gMobile: "mobile",
  gEmail: "email",
  gBadge: "badge_name",
  gDietary: "dietary",
  gAccess: "accessibility",
  gLine: "line",
};
