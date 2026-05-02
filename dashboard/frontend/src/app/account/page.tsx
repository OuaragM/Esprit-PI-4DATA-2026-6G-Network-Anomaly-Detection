"use client";

import { useState } from "react";
import { Badge, Button, Icon, Panel } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import { changeOwnPassword, type User } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/nav";

function AccountPage({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("New password and confirmation don't match."); return; }
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My account</h1>
          <div className="page-desc">Profile and security settings for the current session.</div>
        </div>
      </div>

      <div className="grid dash-grid">
        <div className="span-6">
          <Panel title="Profile" subtitle="read-only — contact an admin to change">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Email</span>
                <span className="mono">{user.email}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Full name</span>
                <span>{user.full_name}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Role</span>
                <Badge tone={user.role === "admin" ? "critical" : user.role === "data_scientist" ? "accent" : "default"}>
                  {ROLE_LABELS[user.role]}
                </Badge>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">User ID</span>
                <span className="mono muted" style={{ fontSize: 11 }}>{user.id}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="span-6">
          <Panel title="Change password" subtitle="self-service — current password required">
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="form-row">
                <span className="muted" style={{ fontSize: 13, width: 140 }}>Current password</span>
                <input
                  type="password" required
                  value={current} disabled={busy}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </label>
              <label className="form-row">
                <span className="muted" style={{ fontSize: 13, width: 140 }}>New password</span>
                <input
                  type="password" required minLength={8}
                  value={next} disabled={busy}
                  onChange={(e) => setNext(e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </label>
              <label className="form-row">
                <span className="muted" style={{ fontSize: 13, width: 140 }}>Confirm new</span>
                <input
                  type="password" required minLength={8}
                  value={confirm} disabled={busy}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </label>
              {error && (
                <div className="alert alert-crit">
                  <Icon name="warn" size={14} />
                  <div className="alert-body" style={{ fontSize: 12 }}>{error}</div>
                </div>
              )}
              {success && (
                <div className="muted" style={{ fontSize: 12, color: "var(--ok)" }}>
                  ✓ Password changed.
                </div>
              )}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Change password"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function AccountRoute() {
  return (
    <AppShell crumbs={["Account"]}>
      {(user) => <AccountPage user={user} />}
    </AppShell>
  );
}
