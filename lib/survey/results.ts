import { createServiceClient } from "@/lib/supabaseService";
import type { Round, Team, ValueWithBehaviors } from "@/lib/survey/data";

/** Everything the reports need for a client's latest opened survey round. */
export type ResultLeader = { id: string; name: string; team_id: string | null; responses: number };
export type ScoreRow = { leader_id: string; behavior_id: string; avg_score: number; n: number };
export type ResultsData = {
  missing: boolean;
  error: string | null;
  round: Round | null;
  values: ValueWithBehaviors[];
  teams: Team[];
  leaders: ResultLeader[];
  rows: ScoreRow[];
};

export async function loadResults(orgId: string): Promise<ResultsData> {
  const s = createServiceClient();
  const empty: ResultsData = { missing: false, error: null, round: null, values: [], teams: [], leaders: [], rows: [] };
  const cols = "id, title, status, anonymity_threshold, opened_at, closed_at";

  // Prefer the latest round that has opened; fall back to a draft so the page can say so.
  const opened = await s
    .from("survey_rounds")
    .select(cols)
    .eq("organization_id", orgId)
    .in("status", ["open", "closed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (opened.error) return { ...empty, missing: true, error: opened.error.message };
  let round = ((opened.data ?? [])[0] as Round | undefined) ?? null;
  if (!round) {
    const any = await s.from("survey_rounds").select(cols).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1);
    round = ((any.data ?? [])[0] as Round | undefined) ?? null;
    return { ...empty, round };
  }

  const [v, b, t, l, c, sc] = await Promise.all([
    s.from("survey_values").select("id, name, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_behaviors").select("id, value_id, text, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_teams").select("id, name, sort_order").eq("round_id", round.id).order("sort_order"),
    s.from("survey_leaders").select("id, name, team_id, created_at").eq("round_id", round.id).order("created_at"),
    s.from("survey_leader_counts").select("leader_id, responses").eq("round_id", round.id),
    s.from("survey_leader_behavior_scores").select("leader_id, behavior_id, avg_score, n").eq("round_id", round.id),
  ]);
  const failed = [v, b, t, l, c, sc].find((r) => r.error);
  if (failed?.error) return { ...empty, round, error: failed.error.message };

  const behaviors = (b.data ?? []) as { id: string; value_id: string; text: string }[];
  const counts = new Map(((c.data ?? []) as { leader_id: string; responses: number }[]).map((x) => [x.leader_id, Number(x.responses) || 0]));
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
    leaders: ((l.data ?? []) as { id: string; name: string; team_id: string | null }[]).map((x) => ({
      id: x.id,
      name: x.name,
      team_id: x.team_id,
      responses: counts.get(x.id) ?? 0,
    })),
    rows: ((sc.data ?? []) as { leader_id: string; behavior_id: string; avg_score: number | string; n: number }[]).map((r) => ({
      leader_id: r.leader_id,
      behavior_id: r.behavior_id,
      avg_score: Number(r.avg_score),
      n: Number(r.n) || 0,
    })),
  };
}
