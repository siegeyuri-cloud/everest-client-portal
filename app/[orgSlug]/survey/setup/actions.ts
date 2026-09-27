"use server";

import { revalidatePath } from "next/cache";
import { requireEverestAdmin } from "@/lib/survey/access";
import { createServiceClient } from "@/lib/supabaseService";
import type { Result } from "@/lib/survey/data";

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
  return { s, round };
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
