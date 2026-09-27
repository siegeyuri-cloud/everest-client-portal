import type { Metadata } from "next";
import "./survey.css";
import { loadInvite } from "@/lib/survey/rater";
import SurveyForm from "./SurveyForm";
import SurveyHeader from "./SurveyHeader";

/**
 * /[orgSlug]/survey?invite=...: the survey a rater fills in. Public (see
 * proxy.ts): the one-time invite link is the only key. Not indexed, and the
 * referrer is suppressed so the link never leaks to another site.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Leader values survey",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const NOTICES: Record<string, { title: string; body: (org: string | null) => string }> = {
  invalid: {
    title: "This link doesn't work",
    body: () =>
      "Check that you opened the full link from your invitation. If it still doesn't work, ask the person who sent it for a new one.",
  },
  used: {
    title: "You've already responded",
    body: () => "Thank you. Your ratings were recorded, and each link works only once.",
  },
  draft: {
    title: "This survey hasn't opened yet",
    body: (org) => `Your link is ready and will work as soon as ${org ?? "your organization"} opens the survey.`,
  },
  closed: {
    title: "This survey is closed",
    body: () => "Ratings are no longer being collected. Thank you for your time.",
  },
  missing: {
    title: "This survey isn't available yet",
    body: () => "Please try your link again a little later.",
  },
};

export default async function RaterSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const token = typeof sp.invite === "string" ? sp.invite : "";
  const view = await loadInvite(orgSlug, token);

  if (view.state === "ready") return <SurveyForm token={token} view={view} />;

  const n = NOTICES[view.state];
  return (
    <div className="ecs">
      <SurveyHeader orgName={view.orgName} />
      <main className="ecs-narrow">
        <p className="ecs-eyebrow">Leader values survey</p>
        <h1 className="ecs-title">{n.title}</h1>
        <p className="ecs-lede">{n.body(view.orgName)}</p>
      </main>
    </div>
  );
}
