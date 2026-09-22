import { createServiceClient } from "@/lib/supabaseService";

/**
 * Registrations become HubSpot contacts.
 *
 * Upsert by email rather than blind create, because the same person can
 * register twice (a host who also buys a seat, a guest whose host adds
 * them again) and two records for one human breaks the day-of report
 * more quietly than a missing one.
 *
 * Failures never reach the caller. A registration that saved is saved,
 * whatever HubSpot thinks, so the error goes on the row and the roster
 * page shows it.
 */

const BASE = "https://api.hubapi.com";

type Result =
  | { ok: true; contactId: string; created: boolean }
  | { ok: false; reason: string };

function propsFrom(r: Record<string, unknown>) {
  const s = (v: unknown) => (v == null ? "" : String(v).trim());
  // Only non-empty values are sent. Writing "" would overwrite something
  // a human typed into HubSpot by hand.
  const all: Record<string, string> = {
    email: s(r.email).toLowerCase(),
    firstname: s(r.first_name),
    lastname: s(r.last_name),
    phone: s(r.mobile),
    gala_reference: s(r.reference),
    gala_door: s(r.door),
    gala_dietary: s(r.dietary),
    gala_accessibility: s(r.accessibility),
    gala_badge_name: s(r.badge_name),
    gala_line: s(r.line),
    gala_table_number: s(r.table_number),
    gala_seat_near: s(r.seat_near),
  };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== ""));
}

async function findByEmail(token: string, email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.results?.[0]?.id ?? null;
}

export async function syncToHubSpot(registrationId: string): Promise<Result> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.warn("[gala/hubspot] HUBSPOT_ACCESS_TOKEN missing, nothing will sync");
    return { ok: false, reason: "NO_TOKEN" };
  }

  const supabase = createServiceClient();
  const { data: r } = await supabase
    .from("gala_roster").select("*").eq("id", registrationId).single();
  if (!r) return { ok: false, reason: "NO_SUCH_REGISTRATION" };

  const email = String(r.email ?? "").trim().toLowerCase();
  if (email === "") return { ok: false, reason: "NO_EMAIL" };

  const properties = propsFrom(r as Record<string, unknown>);

  try {
    const existing = await findByEmail(token, email);

    const res = existing
      ? await fetch(`${BASE}/crm/v3/objects/contacts/${existing}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ properties }),
        })
      : await fetch(`${BASE}/crm/v3/objects/contacts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ properties }),
        });

    const body = await res.json();

    if (!res.ok) {
      const msg = String(body?.message ?? `HTTP ${res.status}`).slice(0, 400);
      await supabase.from("gala_registrations").update({
        hubspot_sync_error: msg,
        hubspot_sync_attempts: (Number(r.hubspot_sync_attempts) || 0) + 1,
      }).eq("id", registrationId);
      console.error("[gala/hubspot] sync failed", r.reference, msg);
      return { ok: false, reason: msg };
    }

    await supabase.from("gala_registrations").update({
      hubspot_contact_id: String(body.id),
      hubspot_synced_at: new Date().toISOString(),
      hubspot_sync_error: null,
      hubspot_sync_attempts: (Number(r.hubspot_sync_attempts) || 0) + 1,
    }).eq("id", registrationId);

    return { ok: true, contactId: String(body.id), created: existing === null };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 400);
    await supabase.from("gala_registrations").update({
      hubspot_sync_error: msg,
      hubspot_sync_attempts: (Number(r.hubspot_sync_attempts) || 0) + 1,
    }).eq("id", registrationId);
    console.error("[gala/hubspot] sync threw", r.reference, msg);
    return { ok: false, reason: msg };
  }
}
