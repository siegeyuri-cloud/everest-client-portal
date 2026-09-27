"use client";

import * as React from "react";
import { submitSurvey } from "./actions";
import SurveyHeader from "./SurveyHeader";
import type { RaterReady } from "@/lib/survey/rater";

export default function SurveyForm({ token, view }: { token: string; view: RaterReady }) {
  const [screen, setScreen] = React.useState<"welcome" | "questions" | "done">("welcome");
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [showMissing, setShowMissing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const first = view.leaderName.split(" ")[0];
  const all = view.values.flatMap((v) => v.behaviors);
  const missing = all.filter((b) => !answers[b.id]);
  const answered = all.length - missing.length;

  const toTop = () => window.scrollTo({ top: 0 });
  const jumpTo = (id: string) => {
    const el = document.getElementById("q-" + id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const btn = el.querySelector("button");
    if (btn) setTimeout(() => btn.focus({ preventScroll: true }), 300);
  };
  const submit = () => {
    if (missing.length) {
      setShowMissing(true);
      jumpTo(missing[0].id);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await submitSurvey(token, answers);
      if (r.ok) {
        setScreen("done");
        toTop();
      } else {
        setError(r.error);
      }
    });
  };

  if (screen === "welcome") {
    return (
      <div className="ecs">
        <SurveyHeader orgName={view.orgName} />
        <main className="ecs-narrow">
          <p className="ecs-eyebrow">Leader values survey</p>
          <h1 className="ecs-title">Rate {view.leaderName}</h1>
          <p className="ecs-sub">{view.teamName ? `${view.teamName}, ${view.orgName}` : view.orgName}</p>
          <p className="ecs-lede">
            You&apos;ll rate how often {first} shows {all.length} behaviors tied to {view.orgName}&apos;s values, on a
            scale from 1 ({view.scale[0].toLowerCase()}) to 5 ({view.scale[4].toLowerCase()}). It takes about 3 minutes.
          </p>
          <div className="ecs-card ecs-promise">
            <h2 className="ecs-h3">Your answers stay anonymous</h2>
            <p>
              {first} sees averages only, never individual answers, and only once at least {view.threshold} people have
              responded. Your name is never attached to your ratings.
            </p>
          </div>
          <button
            className="ecs-btn ecs-btn--lg"
            onClick={() => {
              setScreen("questions");
              toTop();
            }}
          >
            Start the survey
          </button>
        </main>
      </div>
    );
  }

  if (screen === "done") {
    return (
      <div className="ecs">
        <SurveyHeader orgName={view.orgName} />
        <main className="ecs-narrow">
          <p className="ecs-eyebrow">Leader values survey</p>
          <h1 className="ecs-title">Thank you</h1>
          <p className="ecs-lede">
            Your ratings for {first} were submitted anonymously. There&apos;s nothing else you need to do, and you can
            close this page.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="ecs">
      <SurveyHeader orgName={view.orgName} />
      <div className="ecs-progress">
        <div className="ecs-progress-in">
          <span className="ecs-muted">
            {answered} of {all.length} answered
          </span>
          <div className="ecs-progress-track">
            <div className="ecs-progress-fill" style={{ width: `${all.length ? (answered / all.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <main className="ecs-narrow" style={{ paddingTop: "var(--space-5)" }}>
        <h1 className="ecs-title">Rate {view.leaderName}</h1>
        {view.values.map((v) => (
          <section className="ecs-qgroup" key={v.id}>
            <h2 className="ecs-h2">{v.name}</h2>
            {v.behaviors.map((b) => {
              const val = answers[b.id];
              const miss = showMissing && !val;
              return (
                <div id={"q-" + b.id} key={b.id} className={"ecs-q" + (miss ? " ecs-q--missing" : "")}>
                  <p className="ecs-qlabel">How often does {first} do this?</p>
                  <p className="ecs-qtext">{b.text}</p>
                  <div role="group" aria-label={b.text} className="ecs-scale">
                    {view.scale.map((label, i) => {
                      const n = i + 1;
                      return (
                        <button
                          type="button"
                          key={n}
                          aria-pressed={val === n}
                          className={"ecs-opt" + (val === n ? " is-on" : "")}
                          onClick={() => setAnswers((a) => ({ ...a, [b.id]: n }))}
                        >
                          <span className="ecs-opt-n">{n}</span>
                          <span className="ecs-opt-l">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {miss && <p className="ecs-qmiss">Still needs an answer</p>}
                </div>
              );
            })}
          </section>
        ))}
        <div className="ecs-submitbar">
          {missing.length > 0 ? (
            <p className="ecs-muted">
              {missing.length} {missing.length === 1 ? "question still needs" : "questions still need"} an answer.{" "}
              <button
                type="button"
                className="ecs-btn ecs-btn--quiet"
                onClick={() => {
                  setShowMissing(true);
                  jumpTo(missing[0].id);
                }}
              >
                Take me there
              </button>
            </p>
          ) : (
            <p className="ecs-muted">All {all.length} answered. Ready when you are.</p>
          )}
          {error && (
            <p className="ecs-msg ecs-msg--error" role="alert">
              {error}
            </p>
          )}
          <button className="ecs-btn ecs-btn--lg" disabled={pending || missing.length > 0} onClick={submit}>
            {pending ? "Submitting..." : "Submit ratings"}
          </button>
        </div>
      </main>
    </div>
  );
}
