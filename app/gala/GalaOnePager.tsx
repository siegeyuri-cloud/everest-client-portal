"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

/**
 * The email gate in front of the sponsorship one-pager. Any element on
 * the page marked data-onepager opens it. Without JavaScript the link
 * still points at the PDF, so nobody is ever locked out.
 */

const PDF_URL = "/gala/sponsorship-one-pager.pdf";
const PDF_NAME = "The-Collective-Gala-Sponsorship.pdf";
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

const label: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase",
  color: "rgba(244,238,226,0.66)",
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "rgba(244,238,226,0.05)",
  border: "1px solid rgba(192,149,81,0.3)", color: "#F4EEE2", fontSize: 16,
  padding: "15px 17px", outline: "none", minHeight: 44,
};

export default function GalaOnePager() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("[data-onepager]");
      if (!el) return;
      e.preventDefault();
      setOpen(true); setDone(false); setErr("");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => emailRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_OK.test(v)) { setErr("That email address does not look right."); return; }
    setSending(true); setErr("");
    const res = await fetch("/api/gala/onepager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: v, first: first.trim() }),
    }).then((r) => r.json()).catch(() => null);
    setSending(false);
    if (!res?.ok) { setErr(res?.error ?? "Something went wrong. Please try again."); return; }
    const a = document.createElement("a");
    a.href = res.url || PDF_URL;
    a.download = PDF_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDone(true);
  }

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 120, background: "rgba(4,8,13,0.72)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        data-onepager-modal
        role="dialog"
        aria-modal="true"
        aria-label="Download the sponsorship one-pager"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460, background: "#0B1521", border: "1px solid rgba(192,149,81,0.3)",
          borderTop: "3px solid #C09551", padding: "36px clamp(22px,5vw,36px) 32px", color: "#F4EEE2",
          display: "flex", flexDirection: "column", gap: 22, position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{
            position: "absolute", top: 10, right: 10, width: 44, height: 44, background: "none", border: "none",
            color: "rgba(244,238,226,0.6)", fontSize: 22, cursor: "pointer",
          }}
        >×</button>

        <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.3em", textTransform: "uppercase", color: "#C09551" }}>
          Sponsorship
        </div>

        {done ? (
          <>
            <h3 style={{ margin: 0, fontFamily: "'Marcellus',Georgia,serif", fontWeight: 400, fontSize: 30, lineHeight: 1.15 }}>
              Your download has started
            </h3>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, lineHeight: 1.55, color: "rgba(244,238,226,0.75)" }}>
              If it did not, <a href={PDF_URL} download={PDF_NAME} style={{ color: "#C09551" }}>download it here</a>.
              Questions about a tier? Write to Reign at{" "}
              <a href="mailto:reign.bach@everestcollective.com" style={{ color: "#C09551" }}>reign.bach@everestcollective.com</a>.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "none", border: "1px solid rgba(192,149,81,0.4)", color: "rgba(244,238,226,0.8)",
                fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", padding: 17, minHeight: 44, cursor: "pointer",
              }}
            >Back to the page</button>
          </>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h3 style={{ margin: 0, fontFamily: "'Marcellus',Georgia,serif", fontWeight: 400, fontSize: 30, lineHeight: 1.15 }}>
              The sponsorship one-pager
            </h3>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, lineHeight: 1.55, color: "rgba(244,238,226,0.75)" }}>
              Every tier, what it includes, and where your name appears on the night. Tell us where to find you and it downloads straight away.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={label}>Email</span>
              <input ref={emailRef} name="opEmail" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={input} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={label}>First name, optional</span>
              <input name="opFirst" type="text" autoComplete="given-name" value={first}
                onChange={(e) => setFirst(e.target.value)} style={input} />
            </label>
            {err ? <div style={{ fontSize: 13, letterSpacing: "0.04em", color: "#E0A25E" }}>{err}</div> : null}
            <button
              type="submit"
              disabled={sending}
              style={{
                background: "#C09551", color: "#0B1521", border: "none", fontSize: 11.5, fontWeight: 500,
                letterSpacing: "0.22em", textTransform: "uppercase", padding: "18px 24px", minHeight: 44,
                cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1,
              }}
            >{sending ? "One moment..." : "Download the one-pager"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
