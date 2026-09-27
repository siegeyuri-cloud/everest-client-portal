import "../survey.css";
import { requireEverestAdmin } from "@/lib/survey/access";
import { loadSetup } from "@/lib/survey/data";
import SetupEditor from "./SetupEditor";

/**
 * /[orgSlug]/survey/setup: Everest admins set up a client's leader values
 * survey. Server component: the admin check runs before anything is read.
 */
export const dynamic = "force-dynamic";

export default async function SurveySetupPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const access = await requireEverestAdmin(orgSlug);
  const data = await loadSetup(access.org.id);
  return <SetupEditor slug={orgSlug} orgName={access.org.name} data={data} />;
}
