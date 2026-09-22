import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabaseService";
import { render, prepare } from "@/lib/gala/template";
import GalaAccordion from "./GalaAccordion";
import GalaWizard from "./GalaWizard";
import "./gala.css";

/**
 * The public gala page.
 *
 * The markup is the design as authored, kept verbatim in
 * static.template.html. Everything that used to be a hardcoded constant
 * inside a 14MB bundle now comes out of Supabase: the seat count, the
 * sponsor wall, the tier availability, the FAQs, the venue.
 *
 * Three things that were live and wrong are structurally impossible here.
 * The internal checklist is not in this template at all. The seat count
 * is derived from gala_capacity rather than a number somebody typed. The
 * sponsor wall shows only rows marked confirmed and show_on_wall, so it
 * is empty until a sponsor actually signs something.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Inaugural Collective Gala",
  description:
    "An evening for faith, family, life, and the North Texas community, benefiting Pregnancy Help 4 U.",
};

const money = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

type TierRow = {
  id: string;
  name: string;
  amount_cents: number;
  // How many seats the tier actually buys. seats_label is the prose
  // version for the page; this is the number the wizard needs when it
  // builds a sponsor's roster.
  seat_count: number;
  seats_label: string;
  recognition: string;
  cap: number | null;
  sort_order: number;
};

export default async function GalaPage() {
  const supabase = createServiceClient();

  const [settingsRes, capacityRes, tiersRes, faqsRes, sponsorsRes, hostsRes] = await Promise.all([
    supabase.from("gala_settings").select("*").eq("id", 1).single(),
    supabase.from("gala_capacity").select("*").maybeSingle(),
    supabase.from("gala_tiers").select("*").eq("active", true).order("sort_order"),
    supabase.from("gala_faqs").select("*").eq("published", true).order("sort_order"),
    supabase
      .from("gala_sponsors")
      .select("id, legal_name, recognition_name, tier_id, status, show_on_wall")
      .eq("status", "confirmed"),
    // A guest picking their host from a list beats typing a name we
    // then have to match by hand. Only hosts with a table to fill.
    supabase
      .from("gala_hosts")
      .select("full_name")
      .not("full_name", "is", null)
      .not("full_name", "ilike", "Playwright%")
      .not("full_name", "ilike", "Fixture Host%")
      .not("full_name", "ilike", "Probe Host%")
      .not("full_name", "ilike", "Roster Check%")
      .order("full_name"),
  ]);

  const s = settingsRes.data;
  if (!s) {
    // Settings row 1 is seeded by migration 0013. Its absence is a
    // deployment problem, not something to paper over with defaults.
    throw new Error("gala_settings row 1 is missing");
  }

  const cap = capacityRes.data;
  const tiers = (tiersRes.data ?? []) as TierRow[];
  const faqs = faqsRes.data ?? [];
  const sponsors = sponsorsRes.data ?? [];

  const capacity = cap?.capacity ?? s.capacity;
  const seatsLeft = cap?.seats_remaining ?? capacity;
  const capacityPct = capacity > 0 ? Math.round(((capacity - seatsLeft) / capacity) * 100) : 0;

  // Tier availability, counted from real sponsors rather than asserted.
  const takenByTier = new Map<string, number>();
  for (const sp of sponsors) {
    // Every confirmed sponsor counts against the cap. Opting off the
    // wall is a recognition preference, not a reason to sell the same
    // Presenting slot twice.
    if (sp.tier_id) takenByTier.set(sp.tier_id, (takenByTier.get(sp.tier_id) ?? 0) + 1);
  }

  // The dropdown's first entry is the opt out, so a guest who does not
  // know their host is not forced to name one.
  const hostNames: string[] = [
    "I do not know yet",
    ...(hostsRes.data ?? [])
      .map((h) => String(h.full_name ?? "").trim())
      .filter((n) => n !== ""),
  ];

  const tierRows = tiers.map((t) => {
    const taken = takenByTier.get(t.id) ?? 0;
    const left = t.cap == null ? null : Math.max(0, t.cap - taken);
    return {
      name: t.name,
      amount: money(t.amount_cents),
      seats: t.seats_label,
      recognition: t.recognition,
      availability:
        left == null ? "Available" : left === 0 ? "No longer available" : `${left} remaining`,
      availColor: left === 0 ? "rgba(244,238,226,0.45)" : "var(--fl-gold)",

      // The wizard renders the same rows as choosable cards, so the
      // fields it needs are added here rather than computed a second
      // time. Two copies of this arithmetic is how the page and the
      // modal end up disagreeing about what is still for sale.
      id: t.id,
      amountCents: t.amount_cents,
      seatCount: t.seat_count,
      soldOut: left === 0,
      // Parsed by the wizard's click listener. Sold out tiers carry no
      // action at all, so the button cannot be chosen.
      pick: left === 0 ? "" : `tier:${t.id}`,
      cursor: left === 0 ? "not-allowed" : "pointer",
      nameColor: left === 0 ? "rgba(244,238,226,0.45)" : "var(--fl-ivory)",
      // Who already holds a capped tier. Uncapped tiers list nobody,
      // because "taken by" on an unlimited tier reads as a warning.
      takenList:
        t.cap == null
          ? ""
          : sponsors
              .filter((sp) => sp.tier_id === t.id && sp.show_on_wall)
              .map((sp) => sp.recognition_name || sp.legal_name)
              .join(", "),
    };
  });

  // The wall, by tier name. A sponsor with no logo uploaded renders as
  // their recognition name, which is better than an empty rectangle.
  const byTierName = (name: string) =>
    sponsors
      .filter((sp) => sp.show_on_wall)
      .filter((sp) => tiers.find((t) => t.id === sp.tier_id)?.name === name)
      .map((sp) => ({ company: sp.recognition_name ?? sp.legal_name, slot: `sponsor-${sp.id}` }));

  const wallPresenting = byTierName("Presenting");
  const wallGold = byTierName("Gold");
  const wallSilver = byTierName("Silver");
  const wallBronze = byTierName("Bronze");

  const scope = {
    // Every answer ships expanded; GalaAccordion collapses them on mount.
    faqs: faqs.map((f) => ({ q: f.question, a: f.answer, open: true, sign: "\u2212" })),
    tiers: tierRows,

    seatsLeft,
    capacity,
    capacityPct,

    // The H1 reads in three lines: this, then COLLECTIVE, then GALA.
    // "By invitation only" is the small line above it and is hardcoded
    // in the markup, which is what I had this pointed at.
    eyebrow: "The Inaugural",
    titleLine: s.event_name,

    mapUrl: s.map_url ?? "#",
    onepagerUrl: s.onepager_url ?? "#",
    ph4uUrl: s.beneficiary_url ?? "#",
    calendarUrl: s.calendar_url ?? "#",

    // The wizard is not built yet, so the modal stays shut and the door
    // buttons are inert. Wiring them to a half-finished form would be
    // worse than leaving them quiet.
    open: false,

    anySponsors: sponsors.length > 0,
    hasPresenting: wallPresenting.length > 0,
    hasGold: wallGold.length > 0,
    hasSilver: wallSilver.length > 0,
    hasBronze: wallBronze.length > 0,
    wallPresenting,
    wallGold,
    wallSilver,
    wallBronze,
  };

  const dir = path.join(process.cwd(), "app/gala");

  // prepare() must run on the TEMPLATE, before render(). Rendering first
  // collapses {{ openDoors }} to an empty string, and then there is no
  // handler attribute left for prepare to rewrite, so the RSVP buttons
  // end up inert. That was the bug.
  const staticTpl = prepare(fs.readFileSync(path.join(dir, "static.template.html"), "utf8"));
  const pageHtml = render(staticTpl, scope);
  const modalTpl = fs.readFileSync(path.join(dir, "modal.template.html"), "utf8");

  return (
    <>
      <div id="gala-content" dangerouslySetInnerHTML={{ __html: pageHtml }} />
      <GalaAccordion />
      <GalaWizard template={modalTpl} tiers={tierRows} hosts={hostNames} />
    </>
  );
}
