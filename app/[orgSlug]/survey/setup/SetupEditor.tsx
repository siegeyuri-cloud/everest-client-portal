"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createRound, saveValues, addTeam, removeTeam, addLeader, removeLeader, setStatus, createInvites } from "./actions";
import type { LinkResult, Result, SetupData } from "@/lib/survey/data";

type DraftValue = { name: string; behaviors: string[] };
const blank = (): DraftValue => ({ name: "", behaviors: ["", ""] });
const STATUS_TEXT: Record<string, string> = {
  draft: "Draft, not open to raters yet",
  open: "Open, raters can submit",
  closed: "Closed, no new ratings",
};

export default function SetupEditor({ slug, orgName, data }: { slug: string; orgName: string; data: SetupData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const serverValues = JSON.stringify(data.values);
  const [values, setValues] = React.useState<DraftValue[]>([blank()]);
  React.useEffect(() => {
    const v = (JSON.parse(serverValues) as SetupData["values"]).map((x) => ({
      name: x.name,
      behaviors: [x.behaviors[0]?.text ?? "", x.behaviors[1]?.text ?? ""],
    }));
    setValues(v.length ? v : [blank()]);
  }, [serverValues]);

  const [teamName, setTeamName] = React.useState("");
  const [leader, setLeader] = React.useState({ name: "", email: "", teamId: "" });
  const [inv, setInv] = React.useState({ leaderId: "", count: 5, emails: "", send: false });
  const [links, setLinks] = React.useState<{ email: string | null; url: string }[] | null>(null);
  const [copied, setCopied] = React.useState(false);
  const linkText = (list: { email: string | null; url: string }[]) =>
    list.map((l) => (l.email ? l.email + "  " : "") + l.url).join("\n");
  const makeLinks = () =>
    startTransition(async () => {
      const rid = data.round?.id;
      if (!rid) return;
      const r: LinkResult = await createInvites(slug, rid, inv.leaderId, inv);
      if (r.ok) {
        setLinks(r.links);
        setCopied(false);
        const made = `Created ${r.links.length} ${r.links.length === 1 ? "link" : "links"}`;
        setMsg({ ok: !r.note, text: r.note ?? (r.emailed ? `${made} and emailed ${r.emailed}.` : `${made}.`) });
        setInv({ ...inv, emails: "", send: false });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  const copyAll = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(linkText(links));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const run = (fn: () => Promise<Result>, done: string, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: done });
        after?.();
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });

  const round = data.round;
  const locked = !round || round.status !== "draft";
  const teamLabel = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? "No team";
  const setValue = (i: number, patch: Partial<DraftValue>) =>
    setValues((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="ecs">
      <div className="ecs-wrap">
        <p className="ecs-eyebrow">Leader values survey</p>
        <h1 className="ecs-title">Set up {orgName}</h1>
        <p className="ecs-lede">
          Enter this client&apos;s values and the behaviors under each, then the teams and leaders being rated.
          Only Everest admins can see this page.
        </p>

        {data.missing && (
          <div className="ecs-notice">
            <strong>The survey database is not set up yet.</strong> Migration 0020 still needs to run in Supabase.
            This page starts working the moment it does.
            <p className="ecs-muted" style={{ marginTop: 6 }}>Database said: {data.error}</p>
          </div>
        )}
        {!data.missing && data.error && <div className="ecs-notice">Part of the survey could not be loaded: {data.error}</div>}

        {msg && (
          <p role="status" className={msg.ok ? "ecs-msg ecs-msg--ok" : "ecs-msg ecs-msg--error"}>
            {msg.text}
          </p>
        )}

        {!data.missing && !round && (
          <div className="ecs-card">
            <h2 className="ecs-h2">No survey yet</h2>
            <p className="ecs-muted">
              Create the survey to start entering values, teams and leaders. Nothing is sent to anyone until you open it.
            </p>
            <div style={{ marginTop: 16 }}>
              <button className="ecs-btn" disabled={pending} onClick={() => run(() => createRound(slug), "Survey created.")}>
                Create the survey
              </button>
            </div>
          </div>
        )}

        {round && (
          <>
            <div className="ecs-card">
              <div className="ecs-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="ecs-h2" style={{ marginBottom: 6 }}>{round.title}</h2>
                  <span className={`ecs-pill ecs-pill--${round.status}`}>{STATUS_TEXT[round.status]}</span>
                </div>
                <div className="ecs-row">
                  {round.status !== "open" && (
                    <button
                      className="ecs-btn"
                      disabled={pending}
                      onClick={() => run(() => setStatus(slug, round.id, "open"), "The survey is open.")}
                    >
                      {round.status === "closed" ? "Reopen survey" : "Open survey"}
                    </button>
                  )}
                  {round.status === "open" && (
                    <button
                      className="ecs-btn ecs-btn--ghost"
                      disabled={pending}
                      onClick={() => run(() => setStatus(slug, round.id, "closed"), "The survey is closed.")}
                    >
                      Close survey
                    </button>
                  )}
                </div>
              </div>
              <p className="ecs-muted" style={{ marginTop: 12 }}>
                A leader&apos;s report unlocks once {round.anonymity_threshold} people have rated them.
              </p>
            </div>

            <div className="ecs-card">
              <h2 className="ecs-h2">Values and behaviors</h2>
              <p className="ecs-muted">
                {locked
                  ? "Values are locked once the survey opens, so every rater answers the same questions."
                  : "Each value needs exactly 2 behaviors. Raters see the behaviors grouped under their value."}
              </p>
              {values.map((v, i) => (
                <div className="ecs-value" key={i}>
                  <div className="ecs-row">
                    <label className="ecs-field">
                      <span className="ecs-label">Value {i + 1}</span>
                      <input
                        className="ecs-input"
                        value={v.name}
                        disabled={locked}
                        maxLength={80}
                        placeholder="For example, Integrity"
                        onChange={(e) => setValue(i, { name: e.target.value })}
                      />
                    </label>
                    {!locked && values.length > 1 && (
                      <button className="ecs-btn ecs-btn--quiet" type="button" onClick={() => setValues((all) => all.filter((_, j) => j !== i))}>
                        Remove value
                      </button>
                    )}
                  </div>
                  {v.behaviors.map((b, k) => (
                    <label className="ecs-field" key={k}>
                      <span className="ecs-label">Behavior {k + 1}</span>
                      <input
                        className="ecs-input"
                        value={b}
                        disabled={locked}
                        maxLength={200}
                        placeholder={k === 0 ? "For example, Keeps the commitments they make" : "For example, Communicates proactively"}
                        onChange={(e) => setValue(i, { behaviors: v.behaviors.map((y, m) => (m === k ? e.target.value : y)) })}
                      />
                    </label>
                  ))}
                </div>
              ))}
              {!locked && (
                <div className="ecs-row" style={{ marginTop: 20 }}>
                  <button className="ecs-btn ecs-btn--ghost" type="button" onClick={() => setValues((all) => [...all, blank()])}>
                    Add a value
                  </button>
                  <button className="ecs-btn" disabled={pending} onClick={() => run(() => saveValues(slug, round.id, values), "Values saved.")}>
                    Save values
                  </button>
                </div>
              )}
            </div>

            <div className="ecs-card">
              <h2 className="ecs-h2">Teams</h2>
              {data.teams.length === 0 ? (
                <p className="ecs-muted">No teams yet. Add the teams your leaders belong to, such as Operations or Sales.</p>
              ) : (
                <ul className="ecs-list">
                  {data.teams.map((t) => (
                    <li key={t.id}>
                      <span>{t.name}</span>
                      <button
                        className="ecs-btn ecs-btn--quiet"
                        disabled={pending}
                        onClick={() => run(() => removeTeam(slug, round.id, t.id), `Removed ${t.name}.`)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="ecs-row" style={{ marginTop: 16 }}>
                <label className="ecs-field">
                  <span className="ecs-label">New team</span>
                  <input className="ecs-input" value={teamName} maxLength={80} placeholder="Team name" onChange={(e) => setTeamName(e.target.value)} />
                </label>
                <button
                  className="ecs-btn"
                  disabled={pending || !teamName.trim()}
                  onClick={() => run(() => addTeam(slug, round.id, teamName), "Team added.", () => setTeamName(""))}
                >
                  Add team
                </button>
              </div>
            </div>

            <div className="ecs-card">
              <h2 className="ecs-h2">Leaders being rated</h2>
              {data.leaders.length === 0 ? (
                <p className="ecs-muted">No leaders yet. Add each leader and the team they lead.</p>
              ) : (
                <div className="ecs-scroll">
                  <table className="ecs-table">
                    <thead>
                      <tr>
                        <th>Leader</th>
                        <th>Team</th>
                        <th>Email</th>
                        <th>Ratings</th>
                        <th>Links</th>
                        <th aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaders.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.name}</strong></td>
                          <td>{teamLabel(l.team_id)}</td>
                          <td>{l.email ?? ""}</td>
                          <td>
                            {l.responses >= round.anonymity_threshold
                              ? `${l.responses} ratings`
                              : `${l.responses} of ${round.anonymity_threshold} needed`}
                          </td>
                          <td>{l.invites}</td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="ecs-btn ecs-btn--quiet"
                              disabled={pending || l.responses > 0}
                              title={l.responses > 0 ? "Leaders with ratings can't be removed" : undefined}
                              onClick={() => run(() => removeLeader(slug, round.id, l.id), `Removed ${l.name}.`)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="ecs-row" style={{ marginTop: 16 }}>
                <label className="ecs-field">
                  <span className="ecs-label">Name</span>
                  <input className="ecs-input" value={leader.name} maxLength={120} placeholder="Full name" onChange={(e) => setLeader({ ...leader, name: e.target.value })} />
                </label>
                <label className="ecs-field">
                  <span className="ecs-label">Email, optional</span>
                  <input className="ecs-input" type="email" value={leader.email} maxLength={200} placeholder="name@company.com" onChange={(e) => setLeader({ ...leader, email: e.target.value })} />
                </label>
                <label className="ecs-field">
                  <span className="ecs-label">Team</span>
                  <select className="ecs-select" value={leader.teamId} onChange={(e) => setLeader({ ...leader, teamId: e.target.value })}>
                    <option value="">No team</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="ecs-btn"
                  disabled={pending || !leader.name.trim()}
                  onClick={() => run(() => addLeader(slug, round.id, leader), "Leader added.", () => setLeader({ name: "", email: "", teamId: "" }))}
                >
                  Add leader
                </button>
              </div>
            </div>
            <div className="ecs-card">
              <h2 className="ecs-h2">Survey links</h2>
              <p className="ecs-muted">
                Each rater gets their own private link that works once. Paste their emails to create one link each, or
                leave the box empty to create a number of links to share yourself.
              </p>
              {data.leaders.length === 0 ? (
                <p className="ecs-muted" style={{ marginTop: 12 }}>Add a leader first.</p>
              ) : (
                <>
                  <div className="ecs-row" style={{ marginTop: 16 }}>
                    <label className="ecs-field">
                      <span className="ecs-label">Links for</span>
                      <select className="ecs-select" value={inv.leaderId} onChange={(e) => setInv({ ...inv, leaderId: e.target.value })}>
                        <option value="">Choose a leader</option>
                        {data.leaders.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ecs-field" style={{ flex: "0 1 160px" }}>
                      <span className="ecs-label">How many</span>
                      <input
                        className="ecs-input"
                        type="number"
                        min={1}
                        max={100}
                        value={inv.count}
                        disabled={!!inv.emails.trim()}
                        onChange={(e) => setInv({ ...inv, count: Number(e.target.value) || 1 })}
                      />
                    </label>
                  </div>
                  <label className="ecs-field" style={{ marginTop: 12 }}>
                    <span className="ecs-label">Rater emails, optional, one per line</span>
                    <textarea
                      className="ecs-input"
                      rows={4}
                      value={inv.emails}
                      placeholder={"alex@company.com\njordan@company.com"}
                      onChange={(e) => setInv({ ...inv, emails: e.target.value })}
                    />
                  </label>
                  <label className="ecs-check">
                    <input
                      type="checkbox"
                      checked={inv.send}
                      disabled={round.status !== "open" || !inv.emails.trim()}
                      onChange={(e) => setInv({ ...inv, send: e.target.checked })}
                    />
                    Email each person their link{round.status !== "open" ? " (available once the survey is open)" : ""}
                  </label>
                  <div style={{ marginTop: 16 }}>
                    <button className="ecs-btn" disabled={pending || !inv.leaderId} onClick={makeLinks}>
                      Create links
                    </button>
                  </div>
                </>
              )}
              {links && links.length > 0 && (
                <div className="ecs-links">
                  <div className="ecs-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>
                      {links.length} new {links.length === 1 ? "link" : "links"}
                    </strong>
                    <button className="ecs-btn ecs-btn--ghost" type="button" onClick={copyAll}>
                      {copied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                  <p className="ecs-muted" style={{ margin: "8px 0" }}>
                    Copy these now. For privacy, links are stored scrambled, so they can&apos;t be shown again.
                  </p>
                  <textarea className="ecs-input" readOnly rows={Math.min(8, links.length + 1)} value={linkText(links)} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
