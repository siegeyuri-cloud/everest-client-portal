import Link from "next/link";
import { redirect } from "next/navigation";
import "../survey.css";
import { getOrgAccess } from "@/lib/survey/access";
import { loadResults, type ResultsData } from "@/lib/survey/results";

/**
 * /[orgSlug]/survey/results: company, team and leader reports.
 * Everest admins and the client's admin and executive users only. Any leader,
 * team or company total under the round's threshold is hidden, never shown.
 */
export const dynamic = "force-dynamic";

type Agg = { n: number; byB: Record<string, number>; byV: Record<string, number>; overall: number };

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const pos = (x: number) => `${((x - 1) / 4) * 100}%`;

function aggregate(d: ResultsData, leaderIds: string[]): Agg {
  const ids = new Set(leaderIds);
  const n = d.leaders.filter((l) => ids.has(l.id)).reduce((sum, l) => sum + l.responses, 0);
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const r of d.rows) {
    if (!ids.has(r.leader_id)) continue;
    if (!acc[r.behavior_id]) acc[r.behavior_id] = { sum: 0, n: 0 };
    acc[r.behavior_id].sum += r.avg_score * r.n;
    acc[r.behavior_id].n += r.n;
  }
  const byB: Record<string, number> = {};
  for (const [k, a] of Object.entries(acc)) if (a.n) byB[k] = a.sum / a.n;
  const byV: Record<string, number> = {};
  for (const v of d.values) {
    const xs = v.behaviors.map((b) => byB[b.id]).filter((x): x is number => typeof x === "number");
    if (xs.length) byV[v.id] = mean(xs);
  }
  return { n, byB, byV, overall: mean(Object.values(byV)) };
}

function heat(x: number) {
  if (x >= 3.5) return `color-mix(in srgb, var(--ec-glacial-lake) ${Math.round(((x - 3.5) / 1.5) * 55 + 20)}%, var(--surface-card))`;
  if (x < 3) return `color-mix(in srgb, var(--ec-basecamp-tent) ${Math.round(((3 - x) / 2) * 55 + 20)}%, var(--surface-card))`;
  return "var(--surface-sunken)";
}

function Track({ score, company, low }: { score: number; company: number | null; low: boolean }) {
  return (
    <div className="ecs-track" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="ecs-tick" style={{ left: pos(n) }} />
      ))}
      {company !== null && <span className="ecs-ring" style={{ left: pos(company) }} />}
      <span className={"ecs-dot" + (low ? " is-low" : "")} style={{ left: pos(score) }} />
    </div>
  );
}

function Row({ label, score, company, low, sub }: { label: string; score: number; company: number | null; low?: boolean; sub?: boolean }) {
  return (
    <div className={"ecs-trow" + (sub ? " ecs-trow--sub" : "")}>
      <div className="ecs-trow-label">{sub ? label : <strong>{label}</strong>}</div>
      <Track score={score} company={company} low={!!low} />
      <div className="ecs-trow-score">
        <strong>{f1(score)}</strong>
        {company !== null && <span className="ecs-muted"> vs {f1(company)}</span>}
      </div>
    </div>
  );
}

function ValueRows({ d, s, comp, withBehaviors }: { d: ResultsData; s: Agg; comp: Agg | null; withBehaviors: boolean }) {
  const vals = d.values.filter((v) => typeof s.byV[v.id] === "number");
  const lowest = Math.min(...vals.map((v) => s.byV[v.id]));
  return (
    <div>
      {vals.map((v) => (
        <div key={v.id} className="ecs-vblock">
          <Row label={v.name} score={s.byV[v.id]} company={comp ? comp.byV[v.id] ?? null : null} low={vals.length > 1 && s.byV[v.id] === lowest} />
          {withBehaviors &&
            v.behaviors
              .filter((b) => typeof s.byB[b.id] === "number")
              .map((b) => <Row key={b.id} sub label={b.text} score={s.byB[b.id]} company={comp ? comp.byB[b.id] ?? null : null} />)}
        </div>
      ))}
    </div>
  );
}

function Highlights({ d, s }: { d: ResultsData; s: Agg }) {
  const vals = d.values.filter((v) => typeof s.byV[v.id] === "number");
  if (!vals.length) return null;
  const hi = vals.reduce((a, b) => (s.byV[b.id] > s.byV[a.id] ? b : a));
  const lo = vals.reduce((a, b) => (s.byV[b.id] < s.byV[a.id] ? b : a));
  return (
    <div className="ecs-stats">
      <div className="ecs-stat">
        <div className="ecs-stat-big">{f1(s.overall)}</div>
        <div className="ecs-muted">overall, from {s.n} {s.n === 1 ? "rating" : "ratings"}</div>
      </div>
      <div className="ecs-stat ecs-stat--good">
        <div className="ecs-stat-big">{hi.name}</div>
        <div>strongest value, {f1(s.byV[hi.id])}</div>
      </div>
      <div className="ecs-stat ecs-stat--low">
        <div className="ecs-stat-big">{lo.name}</div>
        <div>biggest opportunity, {f1(s.byV[lo.id])}</div>
      </div>
    </div>
  );
}

function Legend({ who }: { who: string }) {
  return (
    <p className="ecs-legend">
      <span><i className="ecs-legend-dot" /> {who}</span>
      <span><i className="ecs-legend-ring" /> Company average</span>
      <span>Scale: 1 Rarely to 5 All of the time</span>
    </p>
  );
}

function Compare({ d, T, rows }: { d: ResultsData; T: number; rows: { key: string; label: string; href: string; agg: Agg }[] }) {
  return (
    <div className="ecs-scroll">
      <table className="ecs-table">
        <thead>
          <tr>
            <th></th>
            {d.values.map((v) => (
              <th key={v.id}>{v.name}</th>
            ))}
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td><Link href={r.href}><strong>{r.label}</strong></Link></td>
              {r.agg.n < T ? (
                <td colSpan={d.values.length + 1} className="ecs-muted">
                  Hidden until {T} ratings (has {r.agg.n})
                </td>
              ) : (
                <>
                  {d.values.map((v) => {
                    const x = r.agg.byV[v.id];
                    return typeof x === "number" ? (
                      <td key={v.id} className="ecs-cell" style={{ background: heat(x) }}>{f1(x)}</td>
                    ) : (
                      <td key={v.id} className="ecs-cell">-</td>
                    );
                  })}
                  <td className="ecs-cell"><strong>{f1(r.agg.overall)}</strong></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ view?: string | string[]; id?: string | string[] }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const access = await getOrgAccess(orgSlug);
  if (!access.isEverestAdmin && access.role !== "admin" && access.role !== "executive") redirect("/no-access");

  const d = await loadResults(access.org.id);
  const base = `/${orgSlug}/survey/results`;
  const view = sp.view === "team" || sp.view === "leader" ? sp.view : "company";
  const id = typeof sp.id === "string" ? sp.id : "";

  const head = (
    <>
      <p className="ecs-eyebrow">Leader values survey results</p>
      <h1 className="ecs-title">{access.org.name}</h1>
    </>
  );
  const wrap = (children: React.ReactNode) => (
    <div className="ecs">
      <div className="ecs-wrap">
        {head}
        {children}
      </div>
    </div>
  );

  if (d.missing) {
    return wrap(
      <div className="ecs-notice">
        <strong>The survey database is not set up yet.</strong> Results appear here once migration 0020 has run and ratings come in.
      </div>,
    );
  }
  if (d.error) return wrap(<div className="ecs-notice">Part of the results could not be loaded: {d.error}</div>);
  if (!d.round) return wrap(<div className="ecs-card"><h2 className="ecs-h2">No survey yet</h2><p className="ecs-muted">Results appear here once a survey has run.</p></div>);
  if (d.round.status === "draft") {
    return wrap(<div className="ecs-card"><h2 className="ecs-h2">The survey hasn&apos;t opened yet</h2><p className="ecs-muted">Results appear here once ratings start coming in.</p></div>);
  }

  const T = d.round.anonymity_threshold;
  const company = aggregate(d, d.leaders.map((l) => l.id));

  const nav = (
    <nav className="ecs-nav" aria-label="Reports">
      <Link href={base} className={"ecs-chip" + (view === "company" ? " is-on" : "")}>Company</Link>
      {d.teams.length > 0 && <span className="ecs-nav-label">Teams</span>}
      {d.teams.map((t) => (
        <Link key={t.id} href={`${base}?view=team&id=${t.id}`} className={"ecs-chip" + (view === "team" && id === t.id ? " is-on" : "")}>{t.name}</Link>
      ))}
      {d.leaders.length > 0 && <span className="ecs-nav-label">Leaders</span>}
      {d.leaders.map((l) => (
        <Link key={l.id} href={`${base}?view=leader&id=${l.id}`} className={"ecs-chip" + (view === "leader" && id === l.id ? " is-on" : "")}>{l.name}</Link>
      ))}
    </nav>
  );
  const status = (
    <p className="ecs-muted" style={{ marginTop: 8 }}>
      {d.round.title}, {d.round.status === "open" ? "open and collecting ratings" : "closed"}. {company.n} {company.n === 1 ? "rating" : "ratings"} across {d.leaders.length} {d.leaders.length === 1 ? "leader" : "leaders"}.
    </p>
  );

  if (company.n === 0) {
    return wrap(<>{status}<div className="ecs-card"><h2 className="ecs-h2">No ratings yet</h2><p className="ecs-muted">Reports fill in as people complete the survey.</p></div></>);
  }

  if (view === "leader") {
    const leader = d.leaders.find((l) => l.id === id);
    if (leader) {
      const s = aggregate(d, [leader.id]);
      const team = d.teams.find((t) => t.id === leader.team_id);
      return wrap(
        <>
          {status}
          {nav}
          <div className="ecs-card">
            <h2 className="ecs-h2">{leader.name}</h2>
            <p className="ecs-muted">{team ? team.name : "No team"}</p>
            {leader.responses < T ? (
              <div className="ecs-hidden">
                <h3 className="ecs-h3">Not enough ratings yet</h3>
                <p>
                  {leader.name} has {leader.responses} of the {T} ratings needed. The report stays hidden until then, so no one&apos;s answers can be identified.
                </p>
              </div>
            ) : (
              <Highlights d={d} s={s} />
            )}
          </div>
          {leader.responses >= T && (
            <div className="ecs-card">
              <h2 className="ecs-h2">By value and behavior</h2>
              <Legend who="This leader" />
              <ValueRows d={d} s={s} comp={company.n >= T ? company : null} withBehaviors />
            </div>
          )}
        </>,
      );
    }
  }

  if (view === "team") {
    const team = d.teams.find((t) => t.id === id);
    if (team) {
      const members = d.leaders.filter((l) => l.team_id === team.id);
      const s = aggregate(d, members.map((l) => l.id));
      return wrap(
        <>
          {status}
          {nav}
          <div className="ecs-card">
            <h2 className="ecs-h2">{team.name} team</h2>
            {s.n < T ? (
              <div className="ecs-hidden">
                <h3 className="ecs-h3">Not enough ratings yet</h3>
                <p>This team has {s.n} of the {T} ratings needed. Its report stays hidden until then.</p>
              </div>
            ) : (
              <Highlights d={d} s={s} />
            )}
          </div>
          {s.n >= T && (
            <>
              <div className="ecs-card">
                <h2 className="ecs-h2">Team average by value</h2>
                <Legend who="This team" />
                <ValueRows d={d} s={s} comp={company.n >= T ? company : null} withBehaviors={false} />
              </div>
              <div className="ecs-card">
                <h2 className="ecs-h2">Leaders on this team</h2>
                <Compare d={d} T={T} rows={members.map((l) => ({ key: l.id, label: l.name, href: `${base}?view=leader&id=${l.id}`, agg: aggregate(d, [l.id]) }))} />
              </div>
            </>
          )}
        </>,
      );
    }
  }

  if (company.n < T) {
    return wrap(
      <>
        {status}
        <div className="ecs-card ecs-hidden">
          <h3 className="ecs-h3">Not enough ratings yet</h3>
          <p>The company report unlocks at {T} ratings. There {company.n === 1 ? "is" : "are"} {company.n} so far.</p>
        </div>
      </>,
    );
  }

  const focus = d.values
    .flatMap((v) => v.behaviors.map((b) => ({ id: b.id, text: b.text, value: v.name, score: company.byB[b.id] })))
    .filter((x): x is { id: string; text: string; value: string; score: number } => typeof x.score === "number")
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const teamRows = [
    ...d.teams.map((t) => ({ key: t.id, label: t.name, href: `${base}?view=team&id=${t.id}`, agg: aggregate(d, d.leaders.filter((l) => l.team_id === t.id).map((l) => l.id)) })),
  ];
  const noTeam = d.leaders.filter((l) => !l.team_id);
  if (noTeam.length) teamRows.push({ key: "none", label: "No team", href: base, agg: aggregate(d, noTeam.map((l) => l.id)) });

  return wrap(
    <>
      {status}
      {nav}
      <div className="ecs-card">
        <h2 className="ecs-h2">Company overview</h2>
        <Highlights d={d} s={company} />
      </div>
      <div className="ecs-card">
        <h2 className="ecs-h2">Company average by value</h2>
        <ValueRows d={d} s={company} comp={null} withBehaviors />
      </div>
      {teamRows.length > 0 && (
        <div className="ecs-card">
          <h2 className="ecs-h2">Teams compared</h2>
          <Compare d={d} T={T} rows={teamRows} />
        </div>
      )}
      {focus.length > 0 && (
        <div className="ecs-card">
          <h2 className="ecs-h2">Where to focus</h2>
          <p className="ecs-muted">The three lowest-rated behaviors across the company.</p>
          {focus.map((x) => (
            <Row key={x.id} sub label={`${x.text} (${x.value})`} score={x.score} company={null} low />
          ))}
        </div>
      )}
    </>,
  );
}
