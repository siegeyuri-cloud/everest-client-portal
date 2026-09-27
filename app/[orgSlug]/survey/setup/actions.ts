"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { requireEverestAdmin } from "@/lib/survey/access";
import { createServiceClient } from "@/lib/supabaseService";
import type { LinkResult, Result } from "@/lib/survey/data";

/**
 * Every action re-checks that the caller is an Everest admin and that the
 * round belongs to this client, whatever the page sent.
 */

const clean = (x: unknown, max = 200) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const no = (error: string): Result => ({ ok: false, error });
function ok(slug: string): Result {
  revalidatePath(`/${slug}/survey/setup`);
  return { ok: true };
}

async function loadRound(slug: string, roundId: string) {
  const access = await requireEverestAdmin(slug);
  const s = createServiceClient();
  const { data } = await s.from("survey_rounds").select("id, status, organization_id").eq("id", roundId).maybeSingle();
  const round =
    data && data.organization_id === access.org.id ? (data as { id: string; status: string; organization_id: string }) : null;
  return { s, round, access };
}

export async function createRound(slug: string): Promise<Result> {
  const access = await requireEverestAdmin(slug);
  const s = createServiceClient();
  const { data: live, error: liveError } = await s
    .from("survey_rounds")
    .select("id")
    .eq("organization_id", access.org.id)
    .in("status", ["draft", "open"])
    .limit(1);
  if (liveError) return no(liveError.message);
  if (live && live.length) return no("This client already has a survey in progress.");
  const { error } = await s.from("survey_rounds").insert({ organization_id: access.org.id, created_by: access.userId });
  return error ? no(error.message) : ok(slug);
}

export async function saveValues(slug: string, roundId: string, input: { name: string; behaviors: string[] }[]): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  if (round.status !== "draft") return no("Values are locked once the survey opens.");

  const values = (Array.isArray(input) ? input : []).map((v) => ({
    name: clean(v?.name, 80),
    behaviors: (Array.isArray(v?.behaviors) ? v.behaviors : []).map((b) => clean(b, 200)),
  }));
  if (values.length === 0 || values.length > 12) return no("Add between 1 and 12 values.");
  for (const v of values) {
    if (!v.name) return no("Every value needs a name.");
    if (v.behaviors.length !== 2 || v.behaviors.some((b) => !b)) return no(`"${v.name}" needs exactly 2 behaviors.`);
  }

  const del = await s.from("survey_values").delete().eq("round_id", roundId);
  if (del.error) return no(del.error.message);
  const valueRows = values.map((v, i) => ({ id: crypto.randomUUID(), round_id: roundId, name: v.name, sort_order: i }));
  const insV = await s.from("survey_values").insert(valueRows);
  if (insV.error) return no(insV.error.message);
  const behaviorRows = values.flatMap((v, i) =>
    v.behaviors.map((text, j) => ({ round_id: roundId, value_id: valueRows[i].id, text, sort_order: j })),
  );
  const insB = await s.from("survey_behaviors").insert(behaviorRows);
  return insB.error ? no(insB.error.message) : ok(slug);
}

export async function addTeam(slug: string, roundId: string, name: string): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  const n = clean(name, 80);
  if (!n) return no("Give the team a name.");
  const { count } = await s.from("survey_teams").select("id", { count: "exact", head: true }).eq("round_id", roundId);
  const { error } = await s.from("survey_teams").insert({ round_id: roundId, name: n, sort_order: count ?? 0 });
  return error ? no(error.message) : ok(slug);
}

export async function removeTeam(slug: string, roundId: string, teamId: string): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  const { error } = await s.from("survey_teams").delete().eq("id", teamId).eq("round_id", roundId);
  return error ? no(error.message) : ok(slug);
}

export async function addLeader(slug: string, roundId: string, input: { name: string; email: string; teamId: string }): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  const name = clean(input?.name, 120);
  const email = clean(input?.email, 200).toLowerCase();
  const teamId = clean(input?.teamId, 64);
  if (!name) return no("Enter the leader's name.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return no("That email address doesn't look right.");
  if (teamId) {
    const { data: team } = await s.from("survey_teams").select("id").eq("id", teamId).eq("round_id", roundId).maybeSingle();
    if (!team) return no("Pick a team from this survey.");
  }
  const { error } = await s
    .from("survey_leaders")
    .insert({ round_id: roundId, name, email: email || null, team_id: teamId || null });
  return error ? no(error.message) : ok(slug);
}

export async function removeLeader(slug: string, roundId: string, leaderId: string): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  const { count } = await s.from("survey_responses").select("id", { count: "exact", head: true }).eq("leader_id", leaderId);
  if ((count ?? 0) > 0) return no("This leader already has ratings, so they can't be removed.");
  const { error } = await s.from("survey_leaders").delete().eq("id", leaderId).eq("round_id", roundId);
  return error ? no(error.message) : ok(slug);
}

export async function setStatus(slug: string, roundId: string, next: "open" | "closed"): Promise<Result> {
  const { s, round } = await loadRound(slug, roundId);
  if (!round) return no("Survey not found for this client.");
  const now = new Date().toISOString();
  if (next === "open") {
    if (round.status === "open") return ok(slug);
    const [vals, behs, leads] = await Promise.all([
      s.from("survey_values").select("id", { count: "exact", head: true }).eq("round_id", roundId),
      s.from("survey_behaviors").select("id", { count: "exact", head: true }).eq("round_id", roundId),
      s.from("survey_leaders").select("id", { count: "exact", head: true }).eq("round_id", roundId),
    ]);
    const v = vals.count ?? 0;
    if (!v) return no("Add and save at least one value before opening the survey.");
    if ((behs.count ?? 0) !== v * 2) return no("Every value needs its 2 behaviors saved before opening.");
    if (!(leads.count ?? 0)) return no("Add at least one leader before opening the survey.");
    const { error } = await s.from("survey_rounds").update({ status: "open", opened_at: now, closed_at: null, updated_at: now }).eq("id", roundId);
    return error ? no(error.message) : ok(slug);
  }
  if (next === "closed") {
    if (round.status !== "open") return no("Only an open survey can be closed.");
    const { error } = await s.from("survey_rounds").update({ status: "closed", closed_at: now, updated_at: now }).eq("id", roundId);
    return error ? no(error.message) : ok(slug);
  }
  return no("Unknown status.");
}

const escHtml = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

function inviteHtml(org: string, leader: string, first: string, url: string) {
  return `<div style="background:#F0EEEC;padding:32px 16px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#3C4142;">
<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:10px;padding:32px;">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#2B7F85;font-weight:700;">Leader values survey</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#2D3132;">Your feedback for ${escHtml(leader)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escHtml(org)} and Everest Collective are asking for your honest feedback on how ${escHtml(first)} lives the company's values. It takes about 3 minutes.</p>
<p style="margin:24px 0;"><a href="${escHtml(url)}" style="background:#6CCAD0;color:#000000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px;display:inline-block;">Start the survey</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#636466;">Your answers are anonymous. ${escHtml(first)} sees averages only, and only once at least 3 people have responded. This link is just for you and works once.</p>
</div></div>`;
}

/**
 * One private link per rater. Only a SHA-256 hash of each token is stored,
 * so the links are returned here once and can never be shown again.
 */
export async function createInvites(
  slug: string,
  roundId: string,
  leaderId: string,
  input: { emails: string; count: number; send: boolean },
): Promise<LinkResult> {
  const { s, round, access } = await loadRound(slug, roundId);
  if (!round) return { ok: false, error: "Survey not found for this client." };
  if (round.status === "closed") return { ok: false, error: "This survey is closed. Reopen it to create links." };

  const { data: leader } = await s.from("survey_leaders").select("id, name").eq("id", leaderId).eq("round_id", roundId).maybeSingle();
  if (!leader) return { ok: false, error: "Choose a leader from this survey." };

  const raw = String(input?.emails ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const bad = raw.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (bad.length) return { ok: false, error: `These don't look like email addresses: ${bad.slice(0, 3).join(", ")}` };
  const emails = [...new Set(raw)];
  const n = emails.length || Math.floor(Number(input?.count) || 0);
  if (n < 1 || n > 100) return { ok: false, error: "Create between 1 and 100 links at a time." };
  const send = !!input?.send && emails.length > 0;
  if (send && round.status !== "open") return { ok: false, error: "Open the survey before emailing links." };

  const base = (process.env.SURVEY_BASE_URL ?? "https://clients.everestcollective.com").replace(/\/$/, "");
  const made = Array.from({ length: n }, (_, i) => {
    const token = randomBytes(24).toString("base64url");
    return { token, email: emails[i] ?? null, hash: createHash("sha256").update(token).digest("hex") };
  });
  const { error } = await s
    .from("survey_invites")
    .insert(made.map((m) => ({ round_id: roundId, leader_id: leaderId, token_hash: m.hash, rater_email: m.email })));
  if (error) return { ok: false, error: error.message };
  const links = made.map((m) => ({ email: m.email, url: `${base}/${slug}/survey?invite=${m.token}` }));

  let emailed = 0;
  let note: string | null = null;
  if (send) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      note = "Links created, but email is not configured, so none were sent.";
    } else {
      const from = process.env.SURVEY_FROM_EMAIL ?? "Everest Collective <survey@everestcollective.com>";
      const name = String(leader.name);
      const first = name.split(" ")[0];
      const batch = made
        .map((m, i) => ({ m, url: links[i].url }))
        .filter((x) => x.m.email)
        .map((x) => ({
          from,
          to: x.m.email as string,
          subject: `Your anonymous feedback for ${name}`,
          html: inviteHtml(access.org.name, name, first, x.url),
          text: `${access.org.name} and Everest Collective are asking for your honest feedback on ${name}. It takes about 3 minutes.\n\nStart the survey: ${x.url}\n\nYour answers are anonymous. ${first} sees averages only, and only once at least 3 people have responded. This link is just for you and works once.`,
        }));
      const r = await new Resend(key).batch.send(batch);
      if (r.error) {
        console.error("[survey] invite batch failed", r.error);
        note = "Links created, but the emails could not be sent. Copy the links below instead.";
      } else {
        emailed = batch.length;
        await s
          .from("survey_invites")
          .update({ sent_at: new Date().toISOString() })
          .in("token_hash", made.filter((m) => m.email).map((m) => m.hash));
      }
    }
  }
  revalidatePath(`/${slug}/survey/setup`);
  return { ok: true, links, emailed, note };
}
