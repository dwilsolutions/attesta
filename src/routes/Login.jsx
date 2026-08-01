import React, { useState } from "react";
import { supabase, hasSupabase } from "../lib/supabase";
import { C, F } from "../lib/theme";
import { ShieldCheck, ArrowRight, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    if (!hasSupabase) { window.location.href = "/"; return; }
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin },
    });
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div style={{ fontFamily: F.body, color: C.ink, background: C.paper,
      minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.panel,
        border: `1px solid ${C.line}`, borderRadius: 14, padding: "36px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.seal,
            display: "grid", placeItems: "center" }}>
            <ShieldCheck size={18} color="#fff" />
          </div>
          <span style={{ fontFamily: F.display, fontSize: 25, fontWeight: 600,
            letterSpacing: "-0.02em" }}>Attesta</span>
        </div>

        {sent ? (
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 8px" }}>Check your email</h1>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
              We sent a sign-in link to <strong>{email}</strong>. Open it on this device.
            </p>
          </div>
        ) : (
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 6px" }}>Sign in</h1>
            <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 20px" }}>
              {hasSupabase ? "We'll email you a secure link." : "Mock mode — no email needed."}
            </p>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: C.faint }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" type="email"
                onKeyDown={(e) => e.key === "Enter" && send()}
                style={{ width: "100%", padding: "12px 12px 12px 36px", fontSize: 14,
                  border: `1px solid ${C.line}`, borderRadius: 9, boxSizing: "border-box",
                  fontFamily: F.body, color: C.ink }} />
            </div>
            {err && <div style={{ fontSize: 12.5, color: "#B4402F", marginBottom: 10 }}>{err}</div>}
            <button onClick={send}
              style={{ width: "100%", background: C.seal, color: "#fff", border: "none",
                padding: "13px", borderRadius: 9, fontFamily: F.body, fontSize: 14.5,
                fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 7 }}>
              {hasSupabase ? "Send link" : "Enter"} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
