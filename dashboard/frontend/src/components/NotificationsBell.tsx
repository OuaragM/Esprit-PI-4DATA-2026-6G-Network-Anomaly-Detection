"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Icon } from "@/components/ui";
import {
  fetchNotifications,
  isRead,
  markAllRead,
  markRead,
  type Notification,
} from "@/lib/notifications";

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function toneColor(tone: Notification["tone"]): "ok" | "warn" | "critical" | "default" {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "critical") return "critical";
  return "default";
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Initial + 60s poll
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await fetchNotifications();
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unreadCount = items.filter((n) => !isRead(n.id)).length;

  function go(n: Notification) {
    markRead(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
    else setItems((s) => [...s]);  // force re-render to clear unread dot
  }

  function clearAll() {
    markAllRead(items.map((n) => n.id));
    setItems((s) => [...s]);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="icon-btn"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative" }}
      >
        <Icon name="bell" size={15} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2, right: 2,
              minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 8,
              background: "var(--critical)",
              color: "#fff",
              fontSize: 10, fontWeight: 600,
              display: "grid", placeItems: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0, top: "calc(100% + 6px)",
            width: 360, maxWidth: "90vw",
            zIndex: 50,
            border: "1px solid var(--line)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            maxHeight: 480, overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}
        >
          <div className="panel-head" style={{ paddingTop: 10, paddingBottom: 10 }}>
            <div className="panel-title" style={{ fontSize: 13 }}>Notifications</div>
            <button
              className="icon-btn"
              onClick={clearAll}
              title="Mark all as read"
              disabled={unreadCount === 0}
              style={{ fontSize: 11, padding: "2px 8px", color: "var(--fg-muted)" }}
            >
              Clear
            </button>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {items.length === 0 ? (
              <div className="muted" style={{ fontSize: 12, padding: 20, textAlign: "center" }}>
                No notifications.
              </div>
            ) : (
              items.map((n) => {
                const read = isRead(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      background: "transparent",
                      border: 0,
                      borderTop: "1px solid var(--line)",
                      cursor: "pointer",
                      color: "inherit",
                      opacity: read ? 0.6 : 1,
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ gap: 6, alignItems: "center" }}>
                          {!read && (
                            <span style={{
                              width: 6, height: 6, borderRadius: 3,
                              background: "var(--accent)", flexShrink: 0,
                            }} />
                          )}
                          <Badge tone={toneColor(n.tone)} dot>{n.kind.replace(/_/g, " ")}</Badge>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{n.body}</div>
                      </div>
                      <div className="muted" style={{ fontSize: 10, flexShrink: 0 }}>{timeAgo(n.ts)}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
