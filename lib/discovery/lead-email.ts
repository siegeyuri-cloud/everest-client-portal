/**
 * Discovery "new lead" email, from the Claude Design handoff
 * (EMAIL 1: NEW LEAD ALERT). Table-based and inline-styled for Outlook,
 * Gmail and Apple Mail. The design's markup is kept as-is; only the sample
 * values were swapped for placeholders filled in by renderLeadEmail().
 */

const PAGE = "<!DOCTYPE html>\n<html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n<meta name=\"x-apple-disable-message-reformatting\">\n<meta name=\"format-detection\" content=\"telephone=no, date=no, address=no, email=no\">\n<meta name=\"color-scheme\" content=\"light dark\">\n<meta name=\"supported-color-schemes\" content=\"light dark\">\n<title>{{TITLE}}</title>\n<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>table,td,h1,p,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->\n<style>\n@media only screen and (max-width:620px){\n.ec-container{width:100% !important;max-width:100% !important;}\n.ec-pad{padding-left:20px !important;padding-right:20px !important;}\n.ec-stack{display:block !important;width:100% !important;text-align:left !important;}\n.ec-h1{font-size:36px !important;line-height:38px !important;}\n.ec-num{font-size:36px !important;line-height:38px !important;}\n}\n</style>\n</head>\n<body style=\"margin:0;padding:0;width:100%;background-color:#F0EEEC;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;\">\n<div style=\"display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F0EEEC;opacity:0;\">{{PRE}}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" bgcolor=\"#F0EEEC\" style=\"background-color:#F0EEEC;\"><tr><td align=\"center\" style=\"padding:32px 12px;\">\n<!--[if mso]><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" align=\"center\"><tr><td><![endif]-->\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" class=\"ec-container\" style=\"width:600px;max-width:600px;\">\n<tr><td class=\"ec-pad\" bgcolor=\"#2D3132\" style=\"background-color:#2D3132;padding:24px 32px;border-radius:10px 10px 0 0;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td valign=\"middle\"><a href=\"https://everestcollective.com\" style=\"text-decoration:none;\">{{LOGO}}</a></td><td align=\"right\" valign=\"middle\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#6CCAD0;\">New lead</div></td></tr></table></td></tr>\n<tr><td height=\"4\" bgcolor=\"#6CCAD0\" style=\"height:4px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#6CCAD0;\">&nbsp;</td></tr>\n<tr><td bgcolor=\"#FFFFFF\" style=\"background-color:#FFFFFF;border-radius:0 0 10px 10px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2B7F85;\">Wants a conversation · {{WHEN}}</div></td></tr><tr><td height=\"12\" style=\"height:12px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><h1 class=\"ec-h1\" style=\"margin:0;font-family:'Korolev Compressed','Arial Narrow',Arial,Helvetica,sans-serif;font-size:48px;line-height:50px;mso-line-height-rule:exactly;font-weight:700;text-transform:uppercase;letter-spacing:0;color:#2D3132;\">{{NAME}}</h1></td></tr><tr><td height=\"8\" style=\"height:8px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><p style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;mso-line-height-rule:exactly;color:#2D3132;\">{{ROLE}}</p></td></tr><tr><td height=\"24\" style=\"height:24px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td class=\"ec-stack\" width=\"96\" valign=\"top\" style=\"width:96px;padding:0 0 0 0;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#636466;\">Email</div></td><td class=\"ec-stack\" valign=\"top\" style=\"padding:0 0 0 0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;mso-line-height-rule:exactly;color:#2D3132;\"><a href=\"mailto:{{EMAIL}}\" style=\"color:#000000;text-decoration:underline;font-weight:400;\">{{EMAIL}}</a></td></tr>{{PHONEROW}}</table></td></tr><tr><td height=\"28\" style=\"height:28px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" bgcolor=\"#FBAD18\" style=\"border-radius:6px;background-color:#FBAD18;padding:15px 28px;\"><a href=\"mailto:{{EMAIL}}?subject=Your%20Everest%20Discovery%20results\" style=\"display:block;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000000;text-decoration:none;\">Reply to {{FIRST}}</a></td></tr></table></td></tr><tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td height=\"1\" bgcolor=\"#DDD9D4\" style=\"height:1px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#DDD9D4;\">&nbsp;</td></tr></table></td></tr><tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2B7F85;\">Their Discovery results</div></td></tr><tr><td height=\"12\" style=\"height:12px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><h1 class=\"\" style=\"margin:0;font-family:'Korolev Compressed','Arial Narrow',Arial,Helvetica,sans-serif;font-size:32px;line-height:34px;mso-line-height-rule:exactly;font-weight:700;text-transform:uppercase;letter-spacing:0;color:#2D3132;\">{{HEADLINE}}</h1></td></tr><tr><td height=\"24\" style=\"height:24px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#636466;\">Challenges they picked</div></td></tr><tr><td height=\"10\" style=\"height:10px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>{{CHIPS}}</tr></table></td></tr><tr><td height=\"36\" style=\"height:36px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#636466;\">Dimension scores · biggest gap first</div></td></tr><tr><td height=\"10\" style=\"height:10px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td width=\"10\" style=\"padding-right:6px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"10\"><tr><td width=\"10\" height=\"10\" bgcolor=\"#6CCAD0\" style=\"width:10px;height:10px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#6CCAD0;\">&nbsp;</td></tr></table></td><td style=\"padding-right:18px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;color:#636466;\">Today</td><td width=\"10\" style=\"padding-right:6px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"10\"><tr><td width=\"10\" height=\"10\" bgcolor=\"#FFD38D\" style=\"width:10px;height:10px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#FFD38D;\">&nbsp;</td></tr></table></td><td style=\"padding-right:18px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;color:#636466;\">Gap to target</td><td width=\"10\" style=\"padding-right:6px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"10\"><tr><td width=\"10\" height=\"10\" bgcolor=\"#E7E4E0\" style=\"width:10px;height:10px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#E7E4E0;\">&nbsp;</td></tr></table></td><td style=\"padding-right:18px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;color:#636466;\">Out of 5.0</td></tr></table></td></tr><tr><td height=\"20\" style=\"height:20px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr>{{DIMS}}<tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td height=\"1\" bgcolor=\"#DDD9D4\" style=\"height:1px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#DDD9D4;\">&nbsp;</td></tr></table></td></tr><tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"32\"><tr><td width=\"32\" height=\"4\" bgcolor=\"#FBAD18\" style=\"width:32px;height:4px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:#FBAD18;\">&nbsp;</td></tr></table></td></tr><tr><td height=\"16\" style=\"height:16px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#9C6A00;\">The one thing they'd change</div></td></tr><tr><td height=\"12\" style=\"height:12px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr><tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><p style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:22px;line-height:32px;mso-line-height-rule:exactly;color:#2D3132;font-style:italic;font-weight:500;\">{{ONETHING}}</p></td></tr><tr><td height=\"40\" style=\"height:40px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr></table></td></tr>\n<tr><td class=\"ec-pad\" style=\"padding:24px 32px 0;\"><p style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;mso-line-height-rule:exactly;color:#636466;\">Sent automatically by Everest Discovery at <a href=\"https://everestcollective.com/discovery\" style=\"color:#636466;text-decoration:underline;font-weight:400;\">everestcollective.com/discovery</a>.</p><p style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;mso-line-height-rule:exactly;color:#636466;padding-top:6px;\">Aim to reply within one business day.</p></td></tr>\n</table>\n<!--[if mso]></td></tr></table><![endif]-->\n</td></tr></table>\n</body>\n</html>\n";
const PHONE_ROW = "<tr><td class=\"ec-stack\" width=\"96\" valign=\"top\" style=\"width:96px;padding:10px 0 0 0;\"><div style=\"margin:0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#636466;\">Phone</div></td><td class=\"ec-stack\" valign=\"top\" style=\"padding:8px 0 0 0;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;mso-line-height-rule:exactly;color:#2D3132;\"><a href=\"tel:{{TEL}}\" style=\"color:#000000;text-decoration:underline;font-weight:400;\">{{PHONE}}</a></td></tr>";
const CHIP = "<td bgcolor=\"#D9EFF0\" style=\"background-color:#D9EFF0;border-radius:6px;padding:8px 12px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2D3132;\">{{CHIP}}</td>";
const CHIP_GAP = "<td width=\"8\" style=\"width:8px;font-size:1px;\">&nbsp;</td>";
const DIM = "<tr><td class=\"ec-pad\" style=\"padding:0 32px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td class=\"ec-stack\" valign=\"bottom\" style=\"font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;mso-line-height-rule:exactly;font-weight:700;color:#2D3132;padding-bottom:8px;\">{{DNAME}}</td><td class=\"ec-stack\" align=\"right\" valign=\"bottom\" style=\"font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;mso-line-height-rule:exactly;color:#636466;padding-bottom:8px;white-space:nowrap;\">Today <strong style=\"color:#2D3132;\">{{DTODAY}}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Target <strong style=\"color:#2D3132;\">{{DTARGET}}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;<strong style=\"color:#9C6A00;\">Gap {{DGAP}}</strong></td></tr><tr><td colspan=\"2\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"width:100%;\"><tr>{{BARS}}</tr></table></td></tr></table></td></tr>";
const BAR = "<td width=\"{{W}}%\" height=\"12\" bgcolor=\"{{C}}\" style=\"height:12px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;background-color:{{C}};\">&nbsp;</td>";
const DIM_GAP = "<tr><td height=\"20\" style=\"height:20px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;\">&nbsp;</td></tr>";

const TZ = process.env.DISCOVERY_TZ ?? "America/New_York";
const LOGO_URL = process.env.DISCOVERY_EMAIL_LOGO_URL ?? "";

type Dim = { name?: unknown; actual?: unknown; desired?: unknown; gap?: unknown };

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
function fill(tpl: string, vals: Record<string, string>) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, k: string) => (k in vals ? vals[k] : ""));
}

function bars(today: number, target: number) {
  const clamp = (x: number) => Math.max(0, Math.min(5, x));
  const t = Math.round((clamp(today) / 5) * 100);
  const g = Math.max(0, Math.round((clamp(target) / 5) * 100) - t);
  const rest = Math.max(0, 100 - t - g);
  return [
    [t, "#6CCAD0"],
    [g, "#FFD38D"],
    [rest, "#E7E4E0"],
  ]
    .filter(([w]) => (w as number) > 0)
    .map(([w, c]) => fill(BAR, { W: String(w), C: String(c) }))
    .join("");
}

export function renderLeadEmail(d: Record<string, unknown>, when: Date = new Date()) {
  const name = str(d.name) || "Someone";
  const first = name.split(/\s+/)[0];
  const email = str(d.email);
  const phone = str(d.phone);
  const role = [str(d.role), str(d.company)].filter(Boolean).join(", ");

  const dims = (Array.isArray(d.dims) ? (d.dims as Dim[]) : [])
    .map((x) => ({ name: str(x?.name), today: num(x?.actual), target: num(x?.desired), gap: num(x?.gap) }))
    .filter((x) => x.name)
    .sort((a, b) => b.gap - a.gap);
  const top = dims[0];
  const headline = str(d.headline) || (top ? `${top.name} is your greatest opportunity.` : "Discovery completed");
  const picks = (Array.isArray(d.picks) ? d.picks : []).map(str).filter(Boolean);

  const stamp = when.toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const whenText = stamp.replace(/, (\d{1,2}:\d{2})/, " at $1");

  const pre = [role, top ? `Biggest gap: ${top.name} (${f1(top.gap)})` : "", "Reply within one business day."]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");

  const logo = LOGO_URL
    ? `<img src="${esc(LOGO_URL)}" width="200" height="52" alt="Everest Collective" style="display:block;width:200px;height:52px;border:0;outline:none;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#F0EEEC;">`
    : `<span style="font-family:'Korolev Compressed','Arial Narrow',Arial,Helvetica,sans-serif;font-size:26px;line-height:28px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#F0EEEC;">Everest Collective</span>`;

  const oneThing = str(d.oneThing);
  const html = fill(PAGE, {
    TITLE: esc(`Discovery: ${name} wants a conversation`),
    PRE: esc(pre),
    LOGO: logo,
    WHEN: esc(whenText),
    NAME: esc(name),
    ROLE: esc(role),
    EMAIL: esc(email),
    FIRST: esc(first),
    PHONEROW: phone
      ? fill(PHONE_ROW, { TEL: esc(phone.replace(/[^+\d]/g, "")), PHONE: esc(phone) })
      : "",
    HEADLINE: esc(headline),
    CHIPS: picks.map((p) => fill(CHIP, { CHIP: esc(p) })).join(CHIP_GAP),
    DIMS: dims
      .map((x) =>
        fill(DIM, {
          DNAME: esc(x.name),
          DTODAY: f1(x.today),
          DTARGET: f1(x.target),
          DGAP: f1(x.gap),
          BARS: bars(x.today, x.target),
        }),
      )
      .join(DIM_GAP),
    ONETHING: oneThing ? `&ldquo;${esc(oneThing)}&rdquo;` : "They left this one blank.",
  });
  return { subject: `Discovery: ${name} wants a conversation`, html };
}
