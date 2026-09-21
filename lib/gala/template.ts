/**
 * A very small renderer for the gala page markup.
 *
 * The page was authored in Claude Design, whose template language uses
 * exactly three constructs. Rather than hand-convert 46KB of markup into
 * JSX and risk losing the design in translation, the markup is kept
 * verbatim and those three constructs are interpreted here.
 *
 *   {{ expr }}                          interpolation, dotted paths
 *   <sc-if value="{{ x }}">…</sc-if>    conditional
 *   <sc-for list="{{ xs }}" as="x">…    repetition
 *   <image-slot placeholder="…">        a logo nobody has uploaded yet
 *
 * Everything is escaped on the way out. The data comes from Supabase,
 * and a sponsor called <script> should not be able to do anything.
 */

export type Scope = Record<string, unknown>;

/**
 * Rewrite the template's handler attributes into something a delegated
 * click listener can read, and drop the change handlers, which the
 * wizard deliberately does not use.
 *
 * Lives here rather than in the wizard because the server needs it too:
 * the page's own RSVP buttons carry the same attributes and have to be
 * rewritten before the HTML is sent.
 */
export function prepare(tpl: string): string {
  return tpl
    .replace(/sc-camel-on-click="\{\{\s*([^}]+?)\s*\}\}"/g, (_m, n) => {
      const name = String(n).trim();
      // A dotted binding is scoped to a loop item, so every row would
      // otherwise emit the same literal action. Leaving it as a binding
      // lets render() fill in that row's own value, and the row carries
      // something like "tier:silver" for the listener to parse.
      return name.includes(".")
        ? `data-act="{{ ${name} }}"`
        : `data-act="${name}"`;
    })
    .replace(/sc-camel-on-change="\{\{[^}]*\}\}"/g, "");
}

function lookup(path: string, scope: Scope): unknown {
  const clean = path.trim();
  if (clean === "true") return true;
  if (clean === "false") return false;
  let cur: unknown = scope;
  for (const part of clean.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function esc(v: unknown): string {
  if (v == null || v === false) return "";
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

/**
 * Find the close tag matching an already-opened block, counting nested
 * opens of the same tag. One forward scan over both token kinds, because
 * two separate regexes each with their own lastIndex is how you write an
 * off-by-one you will not find by reading it back.
 */
function matchEnd(src: string, openTag: string, from: number) {
  const tok = new RegExp(`<${openTag}\\b|</${openTag}>`, "g");
  tok.lastIndex = from;
  let depth = 1;
  let m = tok.exec(src);
  while (m !== null) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return { inner: src.slice(from, m.index), after: m.index + m[0].length };
    } else {
      depth++;
    }
    m = tok.exec(src);
  }
  throw new Error(`unclosed <${openTag}> from offset ${from}`);
}

function interpolate(s: string, scope: Scope): string {
  return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => esc(lookup(expr, scope)));
}

export function render(tpl: string, scope: Scope): string {
  let out = "";
  let i = 0;

  while (i < tpl.length) {
    const nextFor = tpl.indexOf("<sc-for", i);
    const nextIf = tpl.indexOf("<sc-if", i);
    const nextSlot = tpl.indexOf("<image-slot", i);

    const found = [nextFor, nextIf, nextSlot].filter((n) => n >= 0);
    if (found.length === 0) {
      out += interpolate(tpl.slice(i), scope);
      break;
    }
    const next = Math.min(...found);
    out += interpolate(tpl.slice(i, next), scope);

    if (next === nextFor) {
      const tagEnd = tpl.indexOf(">", next);
      const head = tpl.slice(next, tagEnd + 1);
      const listM = /list="\{\{\s*([^}]+?)\s*\}\}"/.exec(head);
      const asM = /as="(\w+)"/.exec(head);
      const { inner, after } = matchEnd(tpl, "sc-for", tagEnd + 1);
      const list = listM ? lookup(listM[1], scope) : null;
      if (Array.isArray(list)) {
        list.forEach((item, idx) => {
          const child: Scope = { ...scope, ...(asM ? { [asM[1]]: item } : {}), $index: idx };
          out += render(inner, child);
        });
      }
      i = after;
      continue;
    }

    if (next === nextIf) {
      const tagEnd = tpl.indexOf(">", next);
      const head = tpl.slice(next, tagEnd + 1);
      const valM = /value="\{\{\s*([^}]+?)\s*\}\}"/.exec(head);
      const { inner, after } = matchEnd(tpl, "sc-if", tagEnd + 1);
      if (valM && truthy(lookup(valM[1], scope))) out += render(inner, scope);
      i = after;
      continue;
    }

    // image-slot: a sponsor logo nobody has uploaded. Render the name.
    const tagEnd = tpl.indexOf(">", next);
    const closeAt = tpl.indexOf("</image-slot>", next);
    const head = tpl.slice(next, tagEnd + 1);
    const phM = /placeholder="([^"]*)"/.exec(head);
    out +=
      '<div style="display:flex;align-items:center;justify-content:center;width:100%;' +
      "height:100%;border:1px solid rgba(192,149,81,0.28);font-size:11px;" +
      "letter-spacing:0.18em;text-transform:uppercase;" +
      'color:rgba(244,238,226,0.66);text-align:center;padding:8px;">' +
      (phM ? interpolate(phM[1], scope) : "") +
      "</div>";
    i = closeAt >= 0 && closeAt - tagEnd < 200 ? closeAt + 13 : tagEnd + 1;
  }

  return out;
}
