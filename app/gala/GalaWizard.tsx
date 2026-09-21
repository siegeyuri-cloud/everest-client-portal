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

export default function GalaWizard({ template }: { template: string }) {
  const tpl = useMemo(() => prepare(template), [template]);
  const hostRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [door, setDoor] = useState<Door | null>(null);
  const [step, setStep] = useState(-1);
  const [form, setForm] = useState<Form>({});
  const [seats, setSeats] = useState(1);
  const [hasGuest, setHasGuest] = useState<boolean | null>(null);
  const [rosterByEmail, setRosterByEmail] = useState(true);
  const [codeInfo, setCodeInfo] = useState<CodeInfo>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const steps = door ? DOORS[door].steps : [];
  const key = door && step >= 0 && step < steps.length ? steps[step] : null;

  const harvest = useCallback((): Form => {
    const root = hostRef.current;
    if (root === null) return {};
    const out: Form = {};
    root.querySelectorAll<HTMLInputElement>("input[name]").forEach((el) => {
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
      for (const f of YOU_HALF) {
        if (f.req && (merged[f.name] ?? "").trim() === "") problems[f.name] = "Required";
      }
      if ((merged.line ?? "").trim().length < 8) {
        problems.line = "We need your line. Specific beats short.";
      }
    }

    if (key === "company") {
      for (const f of COMPANY_FIELDS) {
        if (f.req && (merged[f.name] ?? "").trim() === "") problems[f.name] = "Required";
      }
    }

    if (Object.keys(problems).length > 0) { setErr(problems); return; }

    setErr({});
    if (step + 1 >= steps.length) { setDone(true); } else { setStep((s) => s + 1); }
  }, [form, harvest, key, step, steps.length]);

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
      nextLabel: key === "review" || key === "pay" ? "Complete registration" : "Continue",

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

      // Not wired yet. Empty renders nothing rather than crashing.
      tierChoices: [], hostOptions: [], rosterRows: [], summary: [],
      rosterN: "", rosterLabel: "", rosterFilled: "",
      payAmount: "", payLabel: "",
      doneEmail: form.email ?? "", doneGuest: "", doneLine: line,
      calendarUrl: "#",
    };
  }, [open, door, step, key, steps.length, form, err, seats, hasGuest,
      rosterByEmail, codeInfo, done]);

  const html = useMemo(() => (open ? render(tpl, scope) : ""), [open, tpl, scope]);

  useEffect(() => {
    const root = hostRef.current;
    if (root === null) return;
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const el = t ? t.closest("[data-act]") : null;
      if (el === null) return;
      const act = el.getAttribute("data-act");
      if (act !== null && actions[act]) { e.preventDefault(); actions[act](); }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [actions]);

  // The RSVP buttons live in the server-rendered page, outside this
  // component, so they are wired from here.
  useEffect(() => {
    const onOpen = (e: Event) => {
      e.preventDefault();
      setOpen(true); setDoor(null); setStep(-1); setDone(false);
    };
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('[data-act="openDoors"]')
    );
    els.forEach((el) => el.addEventListener("click", onOpen));
    return () => els.forEach((el) => el.removeEventListener("click", onOpen));
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
