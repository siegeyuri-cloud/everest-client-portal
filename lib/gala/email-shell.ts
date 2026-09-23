/**
 * One look for every gala email, taken from the site: deep navy, ivory
 * text, gold accents, Marcellus headings, Cormorant Garamond body and
 * Jost small caps. Gmail and Outlook ignore web fonts, so every family
 * falls back to Georgia or Helvetica. Colours are solid hex rather than
 * rgba, because Outlook drops rgba entirely.
 */

const NAVY = "#0B1521";
const CARD = "#101D2D";
const IVORY = "#F4EEE2";
const BODY = "#D3CDC2";
const MUTED = "#9C9A94";
const GOLD = "#C09551";
const RULE = "#3A3C38";

const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const DISPLAY = "'Marcellus',Georgia,'Times New Roman',serif";
const SANS = "'Jost',Helvetica,Arial,sans-serif";

export function escHtml(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

/**
 * eyebrow and heading are plain text and escaped here. paragraphs and
 * note are HTML, so callers escape anything a visitor typed.
 */
export function renderGalaEmail(o: {
  eyebrow: string;
  heading: string;
  paragraphs?: string[];
  rows?: Array<[string, unknown]>;
  note?: string;
}) {
  const paras = (o.paragraphs ?? []).map((p) =>
    '<tr><td style="padding:0 0 16px;font-family:' + SERIF + ';font-size:19px;line-height:1.6;color:' + BODY + ';">' + p + '</td></tr>'
  ).join("");

  const rows = (o.rows ?? []).length === 0 ? "" :
    '<tr><td style="padding:8px 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ' + RULE + ';">'
    + (o.rows ?? []).map(([k, v]) =>
      '<tr>'
      + '<td valign="top" style="padding:13px 16px 13px 0;border-bottom:1px solid ' + RULE + ';font-family:' + SANS + ';font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:' + MUTED + ';white-space:nowrap;">' + escHtml(k) + '</td>'
      + '<td valign="top" style="padding:12px 0;border-bottom:1px solid ' + RULE + ';font-family:' + SERIF + ';font-size:17px;line-height:1.45;color:' + IVORY + ';">' + escHtml(v) + '</td>'
      + '</tr>'
    ).join("")
    + '</table></td></tr>';

  const note = o.note
    ? '<tr><td style="padding:8px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="border:1px solid #5C4F37;padding:16px 20px;font-family:' + SANS + ';font-size:13px;font-weight:300;line-height:1.7;color:' + BODY + ';">' + o.note + '</td>'
      + '</tr></table></td></tr>'
    : "";

  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">'
    + '<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Cormorant+Garamond:wght@400;500&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">'
    + '</head><body style="margin:0;padding:0;background:' + NAVY + ';">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + NAVY + ';"><tr><td align="center" style="padding:40px 16px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:' + CARD + ';border:1px solid ' + RULE + ';border-top:3px solid ' + GOLD + ';">'
    + '<tr><td style="padding:40px 36px 36px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:0 0 14px;font-family:' + SANS + ';font-size:11px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:' + GOLD + ';">' + escHtml(o.eyebrow) + '</td></tr>'
    + '<tr><td style="padding:0 0 24px;font-family:' + DISPLAY + ';font-size:32px;font-weight:400;line-height:1.15;letter-spacing:0.5px;color:' + IVORY + ';">' + escHtml(o.heading) + '</td></tr>'
    + '<tr><td style="padding:0 0 24px;"><div style="height:1px;width:64px;background:' + GOLD + ';line-height:1px;font-size:1px;">&nbsp;</div></td></tr>'
    + paras + rows + note
    + '</table></td></tr></table>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>'
    + '<td align="center" style="padding:24px 12px 0;font-family:' + SANS + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + MUTED + ';line-height:1.8;">'
    + 'The Collective Gala &middot; Thursday, December 3, 2026<br>The Reserve at Marty B&#39;s, Bartonville, Texas<br>'
    + '<span style="color:' + GOLD + ';">Benefiting Pregnancy Help 4 U</span></td></tr></table>'
    + '</td></tr></table></body></html>';
}
