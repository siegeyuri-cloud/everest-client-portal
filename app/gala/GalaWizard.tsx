"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { render, prepare } from "@/lib/gala/template";
import {
  DOORS, YOU_HALF, YOU_FULL, GUEST_HALF, GUEST_FULL, COMPANY_FIELDS,
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

export default function GalaWizard({
  template,
  tiers,
}: {
  template: string;
  tiers: WizardTier[];
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
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const submit = useCallback(async (f: Form) => {
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        door,
        first_name: (f.first ?? "").trim(),
        last_name: (f.last ?? "").trim(),
        email: (f.email ?? "").trim(),
        mobile: (f.mobile ?? "").trim(),
        badge_name: (f.badge ?? "").trim() || null,
        dietary: (f.dietary ?? "").trim() || null,
        accessibility: (f.access ?? "").trim() || null,
        line: (f.line ?? "").trim(),
      };
      if (door === "guest") body.code = (f.code ?? "").trim();

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
        return;
      }
      setRef(res.data.reference);
      setToken(res.data.ticket_token ?? null);
      setDone(true);
    } finally {
      setSending(false);
    }
  }, [door]);

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
    setDoor(d); setStep(0); setErr({});
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
    if (key === "guest") {
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

    if (Object.keys(problems).length > 0) { setErr(problems); return; }

    setErr({});
    // Review is the last step for a door that does not pay, so Continue
    // there is the registration itself, not a page turn.
    if (key === "review" && !steps.includes("pay")) { await submit(merged); return; }

    if (step + 1 >= steps.length) { setDone(true); } else { setStep((s) => s + 1); }
    // tierId and submit both belong here. Without tierId, next() closes
    // over the value from when it was created, which is null.
  }, [form, harvest, key, step, steps, submit, tierId]);


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
        : key === "review" || key === "pay" ? "Complete registration" : "Continue",

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
      hostOptions: [], rosterRows: [],
      rosterN: "", rosterLabel: "", rosterFilled: "",
      payAmount: "", payLabel: "",
      doneEmail: form.email ?? "", doneGuest: "", doneLine: ref,
      calendarUrl: "#",
    };
  }, [open, door, step, key, steps.length, form, err, seats, hasGuest,
      rosterByEmail, codeInfo, done, tiers, tierId, sending, ref]);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
