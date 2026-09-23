import { NextResponse, after } from "next/server";

/**
 * The sponsorship one-pager, behind an email. The visitor gets the PDF
 * whether or not HubSpot answers, because a CRM hiccup should never be
 * the reason a sponsor did not see the tiers. The HubSpot write runs in
 * after() so Vercel does not freeze it halfway, which is what silently
 * dropped the sponsor alert before.
 */

const PDF_URL = "/gala/sponsorship-one-pager.pdf";
const BASE = "https://api.hubapi.com";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const first = String(body?.first ?? "").trim().slice(0, 80);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, error: "That email address does not look right." }, { status: 400 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.warn("[gala/onepager] HUBSPOT_ACCESS_TOKEN missing, contact not saved", email);
  } else {
    after(async () => {
      try {
        const properties: Record<string, string> = { email };
        if (first) properties.firstname = first;
        const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/upsert`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: [{ idProperty: "email", id: email, properties }] }),
        });
        if (!res.ok) {
          console.error("[gala/onepager] hubspot upsert failed", res.status, (await res.text()).slice(0, 400));
        }
      } catch (e) {
        console.error("[gala/onepager] hubspot threw", e);
      }
    });
  }

  return NextResponse.json({ ok: true, url: PDF_URL });
}
