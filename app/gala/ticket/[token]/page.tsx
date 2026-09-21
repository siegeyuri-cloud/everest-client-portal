import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * /gala/ticket/[token] — the thing a guest shows at the door.
 *
 * Public by design. The token is 36 random hex characters and is the only
 * credential, so the page shows nothing that would embarrass anyone if the
 * link were forwarded: a name, a badge line, a table. No email, no phone,
 * no dietary or accessibility notes.
 *
 * Rendered server side so the QR is a plain image needing no JavaScript,
 * which matters on venue wifi at 7pm with 300 people arriving at once.
 */

export const dynamic = "force-dynamic";

const GOLD = "#C09551";
const NIGHT = "#0B1521";
const IVORY = "#F4EEE2";

function NotFound({ message }: { message: string }) {
  return (
    <main style={{ minHeight: "100vh", background: NIGHT, color: IVORY,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 21, lineHeight: 1.5, margin: 0 }}>
          {message}
        </p>
        <p style={{ marginTop: 18, fontSize: 14, color: "rgba(244,238,226,0.6)" }}>
          Write to{" "}
          <a href="mailto:Reign.Bach@everestcollective.com" style={{ color: GOLD }}>
            Reign.Bach@everestcollective.com
          </a>{" "}
          and we will sort it out.
        </p>
      </div>
    </main>
  );
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[a-f0-9]{20,64}$/i.test(token)) {
    return <NotFound message="That ticket link does not look right." />;
  }

  const supabase = createServiceClient();

  const { data: ticket } = await supabase
    .from("gala_tickets")
    .select("token, registration_id, checked_in_at, voided_at")
    .eq("token", token)
    .maybeSingle();

  if (!ticket) return <NotFound message="We cannot find that ticket." />;
  if (ticket.voided_at) return <NotFound message="This ticket has been cancelled." />;

  const { data: r } = await supabase
    .from("gala_roster")
    .select("full_name, badge_reads, line, reference, table_number, host_name, status")
    .eq("id", ticket.registration_id)
    .single();

  if (!r) return <NotFound message="We cannot find that ticket." />;

  const { data: s } = await supabase
    .from("gala_settings")
    .select("event_name, event_starts_at, venue_name, venue_address, map_url")
    .single();

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const scanUrl = base + "/gala/checkin/" + token;

  const qr = await QRCode.toDataURL(scanUrl, {
    width: 520, margin: 1,
    color: { dark: NIGHT, light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });

  const when = s?.event_starts_at
    ? new Date(s.event_starts_at).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        timeZone: "America/Chicago" })
    : "";
  const time = s?.event_starts_at
    ? new Date(s.event_starts_at).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    : "";

  const label = { fontSize: 11, letterSpacing: "0.2em",
    textTransform: "uppercase" as const, color: "rgba(244,238,226,0.45)", margin: 0 };
  const value = { fontSize: 16, color: IVORY, margin: "4px 0 0" };

  return (
    <main style={{ minHeight: "100vh", background: "#07101a", padding: "28px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", background: NIGHT,
        borderTop: "3px solid " + GOLD }}>

        <div style={{ padding: "32px 28px 0" }}>
          <p style={{ ...label, color: GOLD }}>{s?.event_name ?? "The Collective Gala"}</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32,
            lineHeight: 1.15, color: IVORY, margin: "10px 0 0" }}>
            {r.full_name}
          </h1>
          {ticket.checked_in_at && (
            <p style={{ margin: "14px 0 0", padding: "8px 12px",
              background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.4)",
              color: "#6ee7b7", fontSize: 13 }}>
              Checked in at{" "}
              {new Date(ticket.checked_in_at).toLocaleTimeString("en-US", {
                hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}
            </p>
          )}
        </div>

        <div style={{ padding: "26px 28px 0" }}>
          <div style={{ background: "#fff", padding: 14, display: "flex",
            justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={"Ticket " + r.reference} width={260} height={260}
              style={{ display: "block", width: "100%", maxWidth: 260, height: "auto" }} />
          </div>
          <p style={{ margin: "12px 0 0", textAlign: "center", fontFamily: "monospace",
            fontSize: 15, letterSpacing: "0.08em", color: GOLD }}>
            {r.reference}
          </p>
        </div>

        <div style={{ padding: "28px 28px 0" }}>
          <p style={label}>Badge reads</p>
          <p style={value}>{r.badge_reads}</p>

          <p style={{ ...label, marginTop: 20 }}>Talking about</p>
          <p style={{ ...value, fontFamily: "Georgia, serif", lineHeight: 1.45 }}>{r.line}</p>

          <p style={{ ...label, marginTop: 20 }}>Table</p>
          <p style={value}>
            {r.table_number ?? "Assigned closer to the night"}
            {r.host_name && (
              <span style={{ display: "block", fontSize: 14,
                color: "rgba(244,238,226,0.55)" }}>{r.host_name}</span>
            )}
          </p>

          <p style={{ ...label, marginTop: 20 }}>When</p>
          <p style={value}>{when}{time ? ", " + time : ""}</p>

          <p style={{ ...label, marginTop: 20 }}>Where</p>
          <p style={value}>
            {s?.venue_name}
            {s?.venue_address && (
              <span style={{ display: "block", fontSize: 14,
                color: "rgba(244,238,226,0.55)" }}>{s.venue_address}</span>
            )}
          </p>
          {s?.map_url && (
            <a href={s.map_url} style={{ display: "inline-block", marginTop: 14,
              color: GOLD, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase",
              textDecoration: "none", borderBottom: "1px solid " + GOLD, paddingBottom: 2 }}>
              Directions
            </a>
          )}
        </div>

        <div style={{ padding: "30px 28px 34px", marginTop: 26,
          borderTop: "1px solid rgba(192,149,81,0.2)" }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6,
            color: "rgba(244,238,226,0.5)" }}>
            Black tie with a Texas accent. Show this at the door, on your phone or printed.
          </p>
        </div>
      </div>
    </main>
  );
}
