"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { render, prepare } from "@/lib/gala/template";
import {
  DOORS, YOU_HALF, YOU_FULL, GUEST_HALF, GUEST_FULL, COMPANY_FIELDS,
  FIELD_TO_API, GUEST_FIELD_TO_API,
  type Field,
} from "@/lib/gala/wizard-spec";

/**
 * The registration wizard.
 *
 * The markup is the design as authored, interpreted by lib/gala/template
 * rather than hand-converted to JSX. That keeps 38KB of careful
 * typography intact, at the cost of one constraint worth stating:
 *
 *   Re-rendering replaces innerHTML, which destroys input focus. So this
 *   re-renders on step transitions, never on keystrokes. Within a step
 *   the inputs are uncontrolled DOM and their values are read back on
 *   Continue. That is why there is no change handler here even though
 *   the original markup carried one.
 *
 * Clicks are delegated: the template's sc-camel-on-click attributes are
 * rewritten to data-act and one listener dispatches.
 */

const GOLD = "#C09551";
const IVORY = "#F4EEE2";
const DIM = "rgba(244,238,226,0.55)";

type Door = keyof typeof DOORS;
type Form = Record<string, string>;

type CodeInfo = {
  valid: boolean;
  message: string | null;
  hostName: string | null;
  seatsRemaining: number | null;
} | null;


function withValues(fields: Field[], form: Form, err: Record<string, string>) {
  return fields.map((f) => ({
    ...f,
    value: form[f.name] ?? "",
    border: err[f.name] ? "#B4472F" : "rgba(192,149,81,0.3)",
    hint: f.hint ?? "",
  }));
}

export type WizardTier = {
  id: string;
  name: string;
  amount: string;
  amountCents: number;
  seats: string;
  seatCount: number;
  recognition: string;
  availability: string;
  availColor: string;
  soldOut: boolean;
  pick: string;
  cursor: string;
  nameColor: string;
  takenList: string;
};

// Mike, Sept 23: seats and tables buy on Ticket Tailor, which asks for
// every name and meal itself. Invited guests use Reign's RSVP form.
// Only sponsors stay here: a few questions, then Reign is notified.
const BOX_OFFICE_URL = "https://www.tickettailor.com/events/everestcollectivellc/2426641";
const RSVP_FORM_URL = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=FIxrIXQCVUK7h8XvyDxRcpkJvQeunFhHg2VUCervPxpUOUtES00zRElIVUlUU1ZISlpZUk1ORVA5Uy4u";
const HANDOFF: Partial<Record<Door, string>> = {
  seat: BOX_OFFICE_URL,
  host: BOX_OFFICE_URL,
  guest: RSVP_FORM_URL,
};
const ACT_TO_DOOR: Record<string, Door> = {
  pickSeat: "seat", pickHost: "host", pickGuest: "guest", pickSponsor: "sponsor",
};

export default function GalaWizard({
  template,
  tiers,
  hosts,
  calendarUrl,
}: {
  template: string;
  tiers: WizardTier[];
  hosts: string[];
  calendarUrl: string;
}) {
  const tpl = useMemo(() => prepare(template), [template]);
  const hostRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [door, setDoor] = useState<Door | null>(null);
  const [step, setStep] = useState(-1);
  const [form, setForm] = useState<Form>({});
  const [seats, setSeats] = useState(1);
  const [hasGuest, setHasGuest] = useState<boolean | null>(null);
  const [rosterByEmail, setRosterByEmail] = useState(true);
  const [tierId, setTierId] = useState<string | null>(null);
  const [codeInfo, setCodeInfo] = useState<CodeInfo>(null);
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [comped, setComped] = useState(false);

  const submit = useCallback(async (f: Form) => {
    setSending(true);
    try {
      // FIELD_TO_API is the single place the wizard's field names are
      // mapped to the API's. Hand-listing them here is how the sponsor
      // door ended up never sending its tier and failing every time.
      const body: Record<string, unknown> = { door };
      for (const [mine, theirs] of Object.entries(FIELD_TO_API)) {
        const v = (f[mine] ?? "").trim();
        if (v !== "") body[theirs] = v;
      }

      // The API identifies a tier by name, not by id.
      const picked = tiers.find((t) => t.id === tierId) ?? null;
      if (door === "sponsor" && picked !== null) {
        body.tier_name = picked.name;
        const company: Record<string, string> = {
          legal_name: (f.coLegal ?? "").trim(),
          recognition_name: (f.coRecog ?? "").trim(),
        };
        const web = (f.coWeb ?? "").trim();
        if (web !== "") company.website_url = web;
        body.company = company;
      }

      // The plus-one goes nested, and only when they said there is one.
      if (door === "seat" && hasGuest === true) {
        const guest: Record<string, string> = {};
        for (const [mine, theirs] of Object.entries(GUEST_FIELD_TO_API)) {
          const v = (f[mine] ?? "").trim();
          if (v !== "") guest[theirs] = v;
        }
        body.plus_one = guest;
      }

      // The roster becomes invitations. Rows the host left blank are
      // skipped; they can come back and finish later.
      if (door === "host" || door === "sponsor") {
        const roster: Array<{ name?: string; email?: string }> = [];
        for (let i = 0; i < 20; i++) {
          const nm = (f[`rosterName${i}`] ?? "").trim();
          const em = (f[`rosterEmail${i}`] ?? "").trim();
          if (nm === "" && em === "") continue;
          const entry: { name?: string; email?: string } = {};
          if (nm !== "") entry.name = nm;
          if (em !== "") entry.email = em;
          roster.push(entry);
        }
        if (roster.length > 0) body.roster = roster;
      }

      const res = await fetch("/api/gala/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()).catch(() => null);

      if (res?.ok !== true) {
        // Everything they typed stays on screen. Nobody retypes a form
        // because our server had a bad moment.
        setErr({
          submit: res?.error ??
            "We could not complete that. Nothing was charged. Write to Reign.Bach@everestcollective.com and we will finish it by hand.",
        });
        return false;
      }
      setRef(res.data.reference);
      setToken(res.data.ticket_token ?? null);
      setAmountCents(res.data.amount_cents ?? 0);
      setComped(res.data.status === "comped");
      setHostCode(res.data.host_code ?? null);
      setCheckoutUrl(res.data.checkout_url ?? null);
      return true;
    } finally {
      setSending(false);
    }
  }, [door, tiers, tierId, hasGuest]);

  const steps = door ? DOORS[door].steps : [];
  const key = door && step >= 0 && step < steps.length ? steps[step] : null;

  const harvest = useCallback((): Form => {
    const root = hostRef.current;
    if (root === null) return {};
    const out: Form = {};
    root
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input[name], textarea[name], select[name]",
      )
      .forEach((el) => {
        out[el.name] = el.value;
      });
    return out;
  }, []);

  const close = useCallback(() => {
    setOpen(false); setDoor(null); setStep(-1); setErr({}); setDone(false);
  }, []);

  const pick = useCallback((d: Door) => {
    const away = HANDOFF[d];
    if (away) { window.location.assign(away); return; }
    setDoor(d); setStep(0); setErr({});
  }, []);

  // The door buttons have their own click wiring further down. Catching
  // the click on the way in, before any of it runs, means the doors that
  // leave the site do so without the modal flashing open behind them.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
      if (!el) return;
      const d = ACT_TO_DOOR[el.getAttribute("data-act") ?? ""];
      const away = d ? HANDOFF[d] : undefined;
      if (!away) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(away);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const back = useCallback(() => {
    setForm((f) => ({ ...f, ...harvest() }));
    setErr({});
    if (step <= 0) { setDoor(null); setStep(-1); } else { setStep((s) => s - 1); }
  }, [step, harvest]);

  const next = useCallback(async () => {
    const merged = { ...form, ...harvest() };
    setForm(merged);
    const problems: Record<string, string> = {};

    if (key === "code") {
      const res = await fetch("/api/gala/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: (merged.code ?? "").trim() }),
      }).then((r) => r.json()).catch(() => null);

      if (res === null || res.valid !== true) {
        setCodeInfo(res ?? null);
        setErr({ code: res?.message ?? "We could not check that code. Try again." });
        return;
      }
      setCodeInfo(res);
    }

    if (key === "you") {
      const missing = YOU_HALF.filter(
        (f) => f.req && (merged[f.name] ?? "").trim() === "",
      );
      for (const f of missing) problems[f.name] = "Required";
      // A red border alone leaves someone hunting down the form for
      // what is wrong. Say it, in the one slot this step renders.
      if (missing.length > 0) {
        problems.you = `We need ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`;
      }
    }

    // The line is asked on the connect step, not here. Checking it on
    // the you step meant it was always empty, so Continue refused with
    // a message whose only slot lives on a step nobody had reached.
    // Every door was stuck on step 2 with nothing on screen.
    if (key === "connect" && (merged.line ?? "").trim().length < 8) {
      problems.line = "We need your line. Specific beats short.";
    }

    // The plus-one was never checked at all, so the seat door would
    // take a blank guest and put a nameless badge on a table.
    if (key === "guest" && hasGuest === null) {
      problems.guest = "Let us know whether you are bringing someone.";
    }

    if (key === "guest" && hasGuest === true) {
      const missing = GUEST_HALF.filter(
        (f) => f.req && (merged[f.name] ?? "").trim() === "",
      );
      for (const f of missing) problems[f.name] = "Required";
      if (missing.length > 0) {
        problems.guest = `We need ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`;
      }
    }

    if (key === "tier" && tierId === null) {
      setErr({ tier: "Choose a tier to continue." });
      return;
    }

    if (key === "company") {
      const missing = COMPANY_FIELDS.filter(
        (f) => f.req && (merged[f.name] ?? "").trim() === "",
      );
      for (const f of missing) problems[f.name] = "Required";
      if (missing.length > 0) {
        problems.company = `We need ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`;
      }
    }

    if (Object.keys(problems).length > 0) {
      setErr(problems);
      // Let the error render first, then bring the first thing they
      // still have to fill to the middle of the panel.
      requestAnimationFrame(() => {
        const root = hostRef.current;
        if (root === null) return;
        const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input[name], textarea[name]",
        );
        for (const f of fields) {
          if (f.value.trim() === "" && f.offsetParent !== null) {
            f.scrollIntoView({ behavior: "smooth", block: "center" });
            f.focus({ preventScroll: true });
            return;
          }
        }
      });
      return;
    }

    setErr({});
    // Review is where the registration is actually created, on every
    // door. A door that pays then shows the amount the server worked
    // out, so the price on screen is never a second guess at it.
    // The server still requires a line on every registration. Sponsors
    // are no longer asked for one, so theirs is filled in here.
    if (key === "review" && door === "sponsor" && !(merged.line ?? "").trim()) {
      merged.line = "Sponsor, details to follow with Reign";
    }
    if (key === "review") {
      const ok = await submit(merged);
      if (!ok) return;
      if (steps.includes("pay")) { setStep((s) => s + 1); } else { setDone(true); }
      return;
    }

    // Payment is not wired to a provider yet, so finishing here records
    // the registration as pending and tells them an invoice follows.
    if (key === "pay") { setDone(true); return; }

    if (step + 1 >= steps.length) { setDone(true); } else { setStep((s) => s + 1); }
    // tierId and submit both belong here. Without tierId, next() closes
    // over the value from when it was created, which is null.
  }, [form, harvest, key, step, steps, submit, tierId, hasGuest, door]);


  const actions = useMemo<Record<string, () => void>>(() => ({
    close,
    pickSeat: () => pick("seat"),
    pickHost: () => pick("host"),
    pickGuest: () => pick("guest"),
    pickSponsor: () => pick("sponsor"),
    back,
    next: () => void next(),
    setOne: () => setSeats(1),
    setTwo: () => setSeats(2),
    guestYes: () => setHasGuest(true),
    guestNo: () => setHasGuest(false),
    setEmailMode: () => setRosterByEmail(true),
    setCodeMode: () => setRosterByEmail(false),
  }), [close, pick, back, next]);

  const scope = useMemo(() => {
    const total = steps.length;
    const line = form.line ?? "";
    const tog = (on: boolean) => ({
      bg: on ? "rgba(192,149,81,0.16)" : "transparent",
      border: on ? GOLD : "rgba(192,149,81,0.3)",
      color: on ? IVORY : DIM,
    });
    const chosenTier = tiers.find((t) => t.id === tierId) ?? null;
    const s1 = tog(seats === 1), s2 = tog(seats === 2);
    const gY = tog(hasGuest === true), gN = tog(hasGuest === false);
    const em = tog(rosterByEmail), cm = tog(!rosterByEmail);

    // Seats to fill besides their own. A host table seats ten; a
    // sponsorship brings whatever its tier includes.
    const rosterN = door === "host" ? 9
      : door === "sponsor" ? Math.max((chosenTier?.seatCount ?? 10) - 1, 0)
      : 0;

    // One row per seat. The field names are what harvest() picks up,
    // so the row inputs need no handlers of their own.
    const rosterRows = Array.from({ length: rosterN }, (_, i) => ({
      n: String(i + 1),
      nameField: `rosterName${i}`,
      emailField: `rosterEmail${i}`,
      name: form[`rosterName${i}`] ?? "",
      email: form[`rosterEmail${i}`] ?? "",
      code: "Sent with their invitation",
    }));

    const rosterFilled = rosterRows.filter(
      (r) => (form[r.nameField] ?? "").trim() !== "",
    ).length;

    return {
      open,
      // Boolean, not a handler: it gates the door-picking screen.
      atDoors: !done && door === null,
      doorLabel: door ? DOORS[door].label : "",
      stepLabel: done ? "Confirmed"
        : door ? `Step ${step + 1} of ${total}` : "Choose a door",
      progress: done ? "100%"
        : door ? `${Math.round(((step + 1) / total) * 100)}%` : "0%",

      showCode: !done && key === "code",
      showSeats: !done && key === "seats",
      showTable: !done && key === "table",
      showTier: !done && key === "tier",
      showCompany: !done && key === "company",
      showRoster: !done && key === "roster",
      showYou: !done && key === "you",
      showGuest: !done && key === "guest",
      showConnect: !done && key === "connect",
      showReview: !done && key === "review",
      showPay: !done && key === "pay",
      showDone: done,
      showNav: !done && door !== null,
      nextLabel: sending
        ? "Registering..."
        : door === "sponsor" && key === "review" ? "Send to Reign"
        : key === "review" ? "Complete registration"
        : key === "pay" ? "Done for now"
        : "Continue",

      checkoutUrl: checkoutUrl ?? "",
      showCheckout: checkoutUrl !== null,
      showNoCheckout: checkoutUrl === null,
      showHostCode: done && hostCode !== null,
      hostCodeLabel: door === "sponsor" ? "Your guest code" : "Your table code",
      hostCode: hostCode ?? "",
      hostCodeNote: rosterByEmail
        ? "We are emailing everyone you listed. Anyone you did not list can use this code, and each guest registers themselves."
        : door === "sponsor"
          ? "Send this to your guests. Each one registers themselves with it, and your seats fill as they do."
          : "Send this to your guests. Each one registers themselves with it, and your table fills as they do.",

      rosterLabel: door === "sponsor" ? "Who is coming with you" : "Fill your table",
      rosterN: String(rosterN),
      rosterRows,
      rosterFilled: String(rosterFilled),
      // rosterByEmail and the mode colours are set further down, where
      // they already were. Only showCodes is new.
      showCodes: !rosterByEmail,

      payLabel: door === "sponsor" ? "Sponsorship" : door === "host" ? "Table" : "Seats",

      // What to click on Ticket Tailor. Their bundle names, not ours.
      bundleName: door === "host" ? "Table for Ten"
        : door === "sponsor" ? (chosenTier?.name ?? "the sponsorship you chose")
        : seats >= 2 ? "Two Seats"
        : "One Seat",
      payAmount: amountCents > 0
        ? `$${(amountCents / 100).toLocaleString("en-US")}`
        : "To be confirmed",

      youHalf: withValues(YOU_HALF, form, err),
      youFull: withValues(YOU_FULL, form, err),
      guestHalf: withValues(GUEST_HALF, form, err),
      guestFull: withValues(GUEST_FULL, form, err),
      companyFields: withValues(COMPANY_FIELDS, form, err),

      vCode: form.code ?? "", vTableName: form.tableName ?? "",
      vHost: form.host ?? "Not sure yet", vLine: line,
      vSeatNear: form.seatNear ?? "", vGuestLine: form.gLine ?? "",

      errCode: err.code ?? "", errTier: err.tier ?? "", errYou: err.you ?? "",
      errGuest: err.guest ?? "", errLine: err.line ?? "",
      errCompany: err.company ?? "", errRoster: err.roster ?? "",

      lineCount: String(line.length),
      lineBorder: err.line ? "#B4472F" : "rgba(192,149,81,0.3)",
      countColor: line.length > 8 ? GOLD : DIM,

      seatOneBg: s1.bg, seatOneBorder: s1.border, seatOneColor: s1.color,
      seatTwoBg: s2.bg, seatTwoBorder: s2.border, seatTwoColor: s2.color,
      seatTotal: "$" + (seats * 250).toLocaleString("en-US"),

      hasGuest,
      gYesBg: gY.bg, gYesBorder: gY.border, gYesColor: gY.color,
      gNoBg: gN.bg, gNoBorder: gN.border, gNoColor: gN.color,

      rosterByEmail,
      emailModeBg: em.bg, emailModeBorder: em.border,
      codeModeBg: cm.bg, codeModeBorder: cm.border,

      codePreview: codeInfo?.valid
        ? `${codeInfo.hostName} is holding a seat for you` +
          (codeInfo.seatsRemaining ? `, with ${codeInfo.seatsRemaining} still open.` : ".")
        : "",
      // The guest door never charges, whatever the code's own flag says.
      isComp: door === "guest",

      tierChoices: tiers.map((t) => ({
        ...t,
        bg: t.id === tierId ? "rgba(192,149,81,0.16)" : "transparent",
        border: t.id === tierId ? GOLD : "rgba(192,149,81,0.3)",
      })),

      // Not wired yet. Empty renders nothing rather than crashing.
      // What they are about to confirm. Blank answers are dropped
      // rather than shown as empty rows.
      summary: ([
        ["Name", `${form.first ?? ""} ${form.last ?? ""}`.trim()],
        ["Email", form.email ?? ""],
        ["Mobile", form.mobile ?? ""],
        ["Badge", form.badge ?? ""],
        ["Company", form.company ?? ""],
        ["Title", form.title ?? ""],
        ["Host", door === "guest" ? (codeInfo?.hostName ?? "") : ""],
        ["Tier", chosenTier ? `${chosenTier.name}, ${chosenTier.amount}` : ""],
        ["Dietary", form.dietary ?? ""],
        ["Accessibility", form.access ?? ""],
        ["Your line", line],
      ] as Array<[string, string]>)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => ({ k, v })),

      errSubmit: err.submit ?? "",
      hostOptions: hosts,
      doneEmail: form.email ?? "",
      doneGuest: [form.gFirst, form.gLast].filter(Boolean).join(" "),
      doneLine: form.line ?? "",
      ref,

      // Nothing is owed on a comped seat, so that is the only case where
      // finishing the wizard means they are actually in. Everyone else
      // still has to pay, and saying "You are in" to them is a lie.
      doneHeading: door === "guest" ? "You are in"
        : door === "sponsor" ? "Thank you" : "Your place is held",
      // Sponsors pay Reign directly, so there is nothing owed on screen.
      showOwing: door !== "guest" && door !== "sponsor" && amountCents > 0,
      sponsorDone: door === "sponsor",
      owingNote: "Nothing is confirmed until payment clears. Your reference is "
        + ref + ".",
      calendarUrl: calendarUrl || "#",
      showCalendar: calendarUrl !== "",
    };
  }, [open, door, step, key, steps.length, form, err, seats, hasGuest,
      rosterByEmail, codeInfo, done, tiers, tierId, sending, ref, amountCents, comped,
      hostCode, hosts, checkoutUrl, calendarUrl]);

  const html = useMemo(() => (open ? render(tpl, scope) : ""), [open, tpl, scope]);

  useEffect(() => {
    const root = hostRef.current;
    if (root === null) return;
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const el = t ? t.closest("[data-act]") : null;
      if (el === null) return;
      const act = el.getAttribute("data-act");
      if (act === null || act === "") return;

      if (act.startsWith("tier:")) {
        e.preventDefault();
        const id = act.slice(5);
        // Only a tier that is actually on offer. A sold out row carries
        // an empty action and returns above, but this also refuses an
        // id that no longer matches a live tier.
        if (tiers.some((t) => t.id === id && !t.soldOut)) {
          setTierId(id);
          setErr({});
        }
        return;
      }

      if (actions[act]) { e.preventDefault(); actions[act](); }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [actions, tiers]);

  // The page's own buttons live in server-rendered HTML outside this
  // component, so they are wired from here.
  //
  // Two kinds. The RSVP buttons open on the door picker. The four door
  // cards in the doors section open straight onto the door the visitor
  // already chose, rather than asking them to choose twice.
  useEffect(() => {
    const byAct: Record<string, Door | null> = {
      openDoors: null,
      pickSeat: "seat",
      pickHost: "host",
      pickGuest: "guest",
      pickSponsor: "sponsor",
    };

    const bound: Array<[HTMLElement, (e: Event) => void]> = [];

    for (const [act, d] of Object.entries(byAct)) {
      document
        .querySelectorAll<HTMLElement>(`#gala-content [data-act="${act}"]`)
        .forEach((el) => {
          const handler = (e: Event) => {
            e.preventDefault();
            setDone(false);
            setErr({});
            setOpen(true);
            if (d === null) { setDoor(null); setStep(-1); }
            else { setDoor(d); setStep(0); }
          };
          el.addEventListener("click", handler);
          bound.push([el, handler]);
        });
    }

    return () => bound.forEach(([el, h]) => el.removeEventListener("click", h));
  }, []);

  useEffect(() => {
    if (!open) return;
    // Where focus was before the modal took over, so it can go back.
    const opener = document.activeElement as HTMLElement | null;

    const panel = () =>
      hostRef.current?.querySelector<HTMLElement>("[data-modal-panel]") ?? null;

    const tabbable = () => {
      const root = panel();
      if (root === null) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null && !el.hasAttribute("disabled"));
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;

      // Keep Tab inside the modal. Without this the next Tab lands on
      // the page behind, which a keyboard user cannot see past the
      // overlay and cannot get back from.
      const items = tabbable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;

      if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && here === first) { e.preventDefault(); last.focus(); }
      else if (here !== null && !panel()?.contains(here)) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);

    // Move focus in, so the first Tab goes somewhere sensible and a
    // screen reader starts reading the modal rather than the page.
    const t = window.setTimeout(() => { tabbable()[0]?.focus(); }, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Back to whatever they clicked to get here.
      opener?.focus?.();
    };
  }, [open, close]);

  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
