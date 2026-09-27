"use server";

import { createServiceClient } from "@/lib/supabaseService";
import { TOKEN_RE, hashToken } from "@/lib/survey/rater";

/**
 * Rater submission. No login: the private link is the key. Everything is
 * checked again inside submit_survey_response(), in one atomic step.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES: Record<string, string> = {
  invalid: "This link doesn't work. Ask the person who sent it for a new one.",
  used: "This link has already been used. Each link records one set of ratings.",
  closed: "This survey is no longer collecting ratings.",
  incomplete: "Please answer every question before submitting.",
};

export async function submitSurvey(
  token: string,
  answers: Record<string, number>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = String(token ?? "");
  if (!TOKEN_RE.test(t)) return { ok: false, error: MESSAGES.invalid };

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers ?? {})) {
    const n = Number(v);
    if (UUID_RE.test(k) && Number.isInteger(n) && n >= 1 && n <= 5) clean[k] = String(n);
  }

  const { data, error } = await createServiceClient().rpc("submit_survey_response", {
    p_token_hash: hashToken(t),
    p_answers: clean,
  });
  if (error) {
    console.error("[survey] submit failed", error.message);
    return { ok: false, error: "Your ratings couldn't be saved just now. Please try again in a moment." };
  }
  if (data === "ok") return { ok: true };
  return { ok: false, error: MESSAGES[String(data)] ?? "Your ratings couldn't be saved. Please try again." };
}
