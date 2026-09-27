import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabaseService";

/** What a rater sees when they open their private link. Server only. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const DEFAULT_SCALE = ["Rarely", "Some of the time", "About half the time", "Most of the time", "All of the time"];

export type SurveyValue = { id: string; name: string; behaviors: { id: string; text: string }[] };
export type RaterReady = {
  state: "ready";
  orgName: string;
  leaderName: string;
  teamName: string | null;
  scale: string[];
  threshold: number;
  values: SurveyValue[];
};
export type RaterView = RaterReady | { state: "missing" | "invalid" | "used" | "draft" | "closed"; orgName: string | null };

export async function loadInvite(slug: string, token: string): Promise<RaterView> {
  if (!TOKEN_RE.test(token)) return { state: "invalid", orgName: null };
  const s = createServiceClient();

  const { data: inv, error } = await s
    .from("survey_invites")
    .select("round_id, leader_id, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) return { state: "missing", orgName: null };
  if (!inv) return { state: "invalid", orgName: null };

  const { data: round } = await s
    .from("survey_rounds")
    .select("status, anonymity_threshold, scale_labels, organization_id")
    .eq("id", inv.round_id)
    .maybeSingle();
  if (!round) return { state: "invalid", orgName: null };

  // A link only works on its own client's address.
  const { data: org } = await s.from("organizations").select("name, slug").eq("id", round.organization_id).maybeSingle();
  if (!org || org.slug !== slug) return { state: "invalid", orgName: null };
  const orgName = String(org.name);

  if (inv.used_at) return { state: "used", orgName };
  if (round.status === "draft") return { state: "draft", orgName };
  if (round.status !== "open") return { state: "closed", orgName };

  const [{ data: leader }, { data: vals }, { data: behs }] = await Promise.all([
    s.from("survey_leaders").select("name, team_id").eq("id", inv.leader_id).maybeSingle(),
    s.from("survey_values").select("id, name").eq("round_id", inv.round_id).order("sort_order"),
    s.from("survey_behaviors").select("id, value_id, text").eq("round_id", inv.round_id).order("sort_order"),
  ]);
  if (!leader) return { state: "invalid", orgName };

  let teamName: string | null = null;
  if (leader.team_id) {
    const { data: team } = await s.from("survey_teams").select("name").eq("id", leader.team_id).maybeSingle();
    teamName = team?.name ? String(team.name) : null;
  }
  const behaviors = (behs ?? []) as { id: string; value_id: string; text: string }[];
  const labels: string[] =
    Array.isArray(round.scale_labels) && round.scale_labels.length === 5 ? round.scale_labels.map(String) : DEFAULT_SCALE;

  return {
    state: "ready",
    orgName,
    leaderName: String(leader.name),
    teamName,
    scale: labels,
    threshold: Number(round.anonymity_threshold) || 3,
    values: ((vals ?? []) as { id: string; name: string }[])
      .map((v) => ({
        id: v.id,
        name: v.name,
        behaviors: behaviors.filter((b) => b.value_id === v.id).map((b) => ({ id: b.id, text: b.text })),
      }))
      .filter((v) => v.behaviors.length > 0),
  };
}
