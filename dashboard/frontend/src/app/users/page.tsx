"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Icon, Kpi, Panel } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS } from "@/lib/nav";
import {
  type AdminUser,
  type CreateUserPayload,
  type Role,
  type UpdateUserPayload,
  type User,
  adminResetPassword,
  createUser,
  deleteUser,
  hardDeleteUser,
  listUsers,
  updateUser,
} from "@/lib/api";

function Toast({ message, ok, onDismiss }: { message: string; ok: boolean; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 200,
        background: ok ? "var(--ok)" : "var(--critical)",
        color: "#fff", padding: "12px 18px", borderRadius: 8,
        fontSize: 13, fontWeight: 500, maxWidth: 360,
        display: "flex", gap: 10, alignItems: "flex-start",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, marginTop: 1 }}>✕</button>
    </div>
  );
}

const ROLES: Role[] = ["security_analyst", "data_scientist", "admin"];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

// ── Modal ────────────────────────────────────────────────────────────────

type ModalMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; target: AdminUser };

function UserModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  onClose: () => void;
  onSaved: (toastMsg?: string) => void;
}) {
  const isEdit = mode.kind === "edit";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("security_analyst");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode.kind === "edit") {
      setEmail(mode.target.email);
      setFullName(mode.target.full_name);
      setRole(mode.target.role);
      setActive(mode.target.is_active);
    } else if (mode.kind === "create") {
      setEmail("");
      setFullName("");
      setRole("security_analyst");
      setActive(true);
    }
    setError(null);
  }, [mode]);

  if (mode.kind === "closed") return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "create") {
        const payload: CreateUserPayload = {
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          role,
        };
        const resp = await createUser(payload);
        const toastMsg = resp.email_sent
          ? `Invitation sent to ${resp.user.email}`
          : `User created — email could not be delivered (${resp.email_error ?? "unknown error"})`;
        onSaved(toastMsg);
      } else if (mode.kind === "edit") {
        const payload: UpdateUserPayload = {
          full_name: fullName.trim(),
          role,
          is_active: active,
        };
        await updateUser(mode.target.id, payload);
        onSaved();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "grid", placeItems: "center", zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 460, maxWidth: "90vw", border: "1px solid var(--line)" }}
      >
        <div className="panel-head">
          <div className="panel-title">{isEdit ? "Edit user" : "Invite user"}</div>
          <button className="icon-btn" onClick={onClose} type="button"><Icon name="x" /></button>
        </div>
        <form onSubmit={submit} className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!isEdit && (
            <div className="alert" style={{ background: "var(--bg-subtle)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              A secure temporary password will be generated and emailed to the address below. The user must change it on first login.
            </div>
          )}
          <label className="form-row">
            <span className="muted" style={{ fontSize: 13, width: 100 }}>Email</span>
            <input
              type="email" required disabled={isEdit || busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              style={{ flex: 1 }}
            />
          </label>
          <label className="form-row">
            <span className="muted" style={{ fontSize: 13, width: 100 }}>Full name</span>
            <input
              type="text"
              placeholder="Optional"
              value={fullName} disabled={busy}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
              style={{ flex: 1 }}
            />
          </label>
          <label className="form-row">
            <span className="muted" style={{ fontSize: 13, width: 100 }}>Role</span>
            <select
              value={role} disabled={busy}
              onChange={(e) => setRole(e.target.value as Role)}
              className="form-select"
              style={{ flex: 1 }}
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          {isEdit && (
            <label className="row" style={{ gap: 8, fontSize: 13 }}>
              <input
                type="checkbox" checked={active} disabled={busy}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          )}
          {error && (
            <div className="alert alert-crit">
              <Icon name="warn" size={14} />
              <div className="alert-body" style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Sending invite…" : isEdit ? "Save changes" : "Send invitation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

function UsersPage({ user: currentUser }: { user: User }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModalMode>({ kind: "closed" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function refresh() {
    try {
      const u = await listUsers();
      setUsers(u);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
    }
  }

  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => {
    if (!users) return { total: 0, active: 0, admins: 0, analysts: 0, scientists: 0 };
    return {
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      admins: users.filter((u) => u.role === "admin").length,
      analysts: users.filter((u) => u.role === "security_analyst").length,
      scientists: users.filter((u) => u.role === "data_scientist").length,
    };
  }, [users]);

  async function handleDeactivate(target: AdminUser) {
    if (target.id === currentUser.id) {
      alert("You cannot deactivate yourself.");
      return;
    }
    const action = target.is_active ? "deactivate" : "remove";
    if (!confirm(`Are you sure you want to ${action} ${target.email}?`)) return;
    setBusyId(target.id);
    try {
      await deleteUser(target.id);  // soft-delete (sets is_active=false)
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(target: AdminUser) {
    setBusyId(target.id);
    try {
      await updateUser(target.id, { is_active: true });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reactivate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleHardDelete(target: AdminUser) {
    if (!confirm(`Permanently delete ${target.email}? This cannot be undone.`)) return;
    setBusyId(target.id);
    try {
      await hardDeleteUser(target.id);
      await refresh();
      showToast(`${target.email} permanently deleted.`, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(target: AdminUser) {
    const newPwd = prompt(`Set a new password for ${target.email} (min 8 chars):`);
    if (!newPwd) return;
    if (newPwd.length < 8) { alert("Password must be at least 8 characters."); return; }
    setBusyId(target.id);
    try {
      await adminResetPassword(target.id, newPwd);
      alert(`Password reset for ${target.email}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <div className="page-desc">
            Create and manage accounts. Roles control which pages and admin actions each user can reach.
          </div>
        </div>
        <Button variant="primary" icon="upload" onClick={() => setMode({ kind: "create" })}>
          Invite user
        </Button>
      </div>

      <div className="grid dash-grid">
        <div className="span-3"><Kpi label="Total users" value={counts.total} accent /></div>
        <div className="span-3"><Kpi label="Active" value={counts.active} sub={`${counts.total - counts.active} disabled`} /></div>
        <div className="span-3"><Kpi label="Admins" value={counts.admins} /></div>
        <div className="span-3"><Kpi label="Analysts / Scientists" value={`${counts.analysts} / ${counts.scientists}`} /></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel
          title="Accounts"
          subtitle={users == null ? "loading…" : `${users.length} total`}
          actions={<Button variant="ghost" onClick={refresh}>Refresh</Button>}
        >
          {error && (
            <div className="alert alert-crit" style={{ marginBottom: 12 }}>
              <Icon name="warn" size={14} />
              <div className="alert-body" style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}
          {users == null ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>
              No users yet. Click <strong>Invite user</strong> above.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u.id === currentUser.id;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {u.email}{isMe && <span className="muted" style={{ marginLeft: 6 }}>(you)</span>}
                        </td>
                        <td>{u.full_name}</td>
                        <td>
                          <Badge tone={u.role === "admin" ? "critical" : u.role === "data_scientist" ? "accent" : "default"}>
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </td>
                        <td>
                          {u.is_active
                            ? <Badge tone="ok" dot>active</Badge>
                            : <Badge tone="default" dot>disabled</Badge>}
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                        <td>
                          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setMode({ kind: "edit", target: u })}
                              disabled={busy}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={busy}
                              title="Set a new password for this user"
                            >
                              {busy ? "…" : "Reset pwd"}
                            </Button>
                            {u.is_active ? (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleDeactivate(u)}
                                disabled={busy || isMe}
                              >
                                {busy ? "…" : "Deactivate"}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => handleReactivate(u)}
                                  disabled={busy}
                                >
                                  {busy ? "…" : "Reactivate"}
                                </Button>
                                <Button
                                  variant="danger" size="sm"
                                  onClick={() => handleHardDelete(u)}
                                  disabled={busy}
                                  title="Permanently remove this user from the database"
                                >
                                  {busy ? "…" : "Delete"}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title="Roles in the platform">
          <div className="grid dash-grid">
            <div className="span-4">
              <Badge tone="default">{ROLE_LABELS.security_analyst}</Badge>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Front-line: dashboard, history, run new scans. No model or admin access.
              </div>
            </div>
            <div className="span-4">
              <Badge tone="accent">{ROLE_LABELS.data_scientist}</Badge>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Read history, drift &amp; fairness, trigger training runs. No user management.
              </div>
            </div>
            <div className="span-4">
              <Badge tone="critical">{ROLE_LABELS.admin}</Badge>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Full access. Manages users, thresholds, hot-reloads the model.
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <UserModal
        mode={mode}
        onClose={() => setMode({ kind: "closed" })}
        onSaved={(msg) => { refresh(); if (msg) showToast(msg, !msg.toLowerCase().includes("could not")); }}
      />
      {toast && (
        <Toast message={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}

export default function UsersRoute() {
  return (
    <AppShell crumbs={["Administration", "Users"]} roles={["admin"]}>
      {(user) => <UsersPage user={user} />}
    </AppShell>
  );
}
