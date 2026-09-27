import { createServiceClient } from "@/lib/supabaseService";

export type Result = { ok: true } | { ok: false; error: string };
export type Round = {
  id: string;
  title: string;
  status: "draft" | "open" | "closed";
  anonymity_threshold: number;
  opened_at: string | null;
  closed_at: string | null;
};
export type ValueWithBehaviors = { id: string; name: string; behaviors: { id: string; text: string }[] };
export type Team = { id: string; name: string };
export type Leader = { id: string; name: string; email: string | null; team_id: string | null; responses: number; invites: number };
export type SetupData = {
  missing: boolean;
  error: string | null;
  round: Round | null;
  values: ValueWithBehaviors[];
  teams: Team[];
  leaders: Leader[];
};

/** The client's latest survey round and everything in it. */
export async function loadSetup(orgId: string): Promise<SetupData> {
  const s = createServiceClient();
  const empty: SetupData = { missing: false, error: null, round: null, values: [], teams: [], leaders: [] };

  const { data: rounds, error } = await s
    .from("survey_rounds")
    .select("id, title, status, anonymity_threshold, opened_at, closed_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { ...empty, missing: true, error: error.message };
  const round = ((rounds ?? [])[0] as Round | undefined) ?? null;
  if (!round) return empty;

  const [v, b, t, l, c] = await Promise.all([
    s.from("survey_values").select("id, name, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_behaviors").select("id, value_id, text, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_teams").select("id, name, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_leaders").select("id, name, email, team_id, created_at").eq("round_id", round.id).order("created_at"),
    s.from("survey_leader_counts").select("leader_id, responses, invites").eq("round_id", round.id),
  ]);
  const failed = [v, b, t, l, c].find((r) => r.error);
  if (failed?.error) return { ...empty, round, error: failed.error.message };

  const behaviors = (b.data ?? []) as { id: string; value_id: string; text: string }[];
  const counts = new Map(
    ((c.data ?? []) as { leader_id: string; responses: number; invites: number }[]).map((x) => [x.leader_id, x]),
  );
  return {
    missing: false,
    error: null,
    round,
    values: ((v.data ?? []) as { id: string; name: string }[]).map((x) => ({
      id: x.id,
      name: x.name,
      behaviors: behaviors.filter((y) => y.value_id === x.id).map((y) => ({ id: y.id, text: y.text })),
    })),
    teams: ((t.data ?? []) as Team[]).map((x) => ({ id: x.id, name: x.name })),
    leaders: ((l.data ?? []) as { id: string; name: string; email: string | null; team_id: string | null }[]).map((x) => ({
      id: x.id,
      name: x.name,
      email: x.email,
      team_id: x.team_id,
      responses: counts.get(x.id)?.responses ?? 0,
      invites: counts.get(x.id)?.invites ?? 0,
    })),
  };
}
