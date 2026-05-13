"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Icon, Mark, cls } from "@/components/ui";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "@/components/I18nProvider";
import { clearSession, type User } from "@/lib/api";
import { NAV_BY_ROLE } from "@/lib/nav";

/**
 * Sidebar — role-filtered nav, brand mark, user card with sign-out.
 */
function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const items = NAV_BY_ROLE[user.role] ?? NAV_BY_ROLE.security_analyst;

  // Map nav-item key/section text to translation keys. Falls back to the
  // raw English label when an entry isn't in the dictionary yet.
  function navLabel(key: string, fallback: string): string {
    const translated = t(`nav.${key}`);
    return translated === `nav.${key}` ? fallback : translated;
  }
  function sectionLabel(name: string): string {
    const k = name.toLowerCase();
    const translated = t(`nav.${k}`);
    return translated === `nav.${k}` ? name : translated;
  }

  function signOut() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <a
        href="/"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          clearSession();
          router.push("/");
        }}
      >
        <Mark size={26} />
        <div className="brand-name">Verado</div>
        <div className="brand-tag">6G IDS</div>
      </a>

      {items.map((it, i) => {
        if ("section" in it) {
          return <div key={`s-${i}`} className="nav-section-label">{sectionLabel(it.section)}</div>;
        }
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link key={it.key} href={it.href} className={cls("nav-item", active && "active")}>
            <Icon name={it.icon} size={15} />
            <span>{navLabel(it.key, it.label)}</span>
            {it.count != null && <span className="nav-count">{it.count}</span>}
            {it.badge && (
              <span style={{ marginLeft: "auto" }}>
                <Badge tone={it.badge === "warn" ? "warn" : "default"} dot>!</Badge>
              </span>
            )}
          </Link>
        );
      })}

      <div className="sidebar-footer">
        <Link
          href="/account"
          className={cls("user-card", pathname === "/account" && "active")}
          title={t("nav.account")}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="avatar">
            {user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="user-info">
            <div className="user-name">{user.full_name}</div>
            <div className="user-role">{t(`role.${user.role}`)}</div>
          </div>
          <Icon name="settings" size={14} />
        </Link>
        <button
          onClick={signOut}
          className="nav-item"
          style={{ marginTop: 6, width: "100%", border: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "left" }}
        >
          <Icon name="x" size={15} />
          <span>{t("common.signout")}</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * Topbar — breadcrumbs + status badge + per-page actions slot.
 */
function Topbar({
  crumbs,
  status,
  actions,
}: {
  crumbs: string[];
  status?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();

  // If a crumb token is a translation key (or matches a nav.* / dashboard.title etc.),
  // render its translation. Otherwise pass through.
  function crumbLabel(c: string): string {
    // Try as a direct key (e.g. "Workspace"  → "nav.workspace")
    const tryKeys = [
      `nav.${c.toLowerCase()}`,
      `${c.toLowerCase().replace(/\s+/g, "_")}.title`,
      c,
    ];
    for (const k of tryKeys) {
      const v = t(k);
      if (v !== k) return v;
    }
    return c;
  }

  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "cur" : ""}>{crumbLabel(c)}</span>
          </span>
        ))}
      </div>
      <div className="topbar-spacer" />
      {status ?? <Badge tone="ok" dot>{t("common.backend_live")}</Badge>}
      <LangToggle />
      <ThemeToggle />
      <NotificationsBell />
      {actions}
    </div>
  );
}

/**
 * Authenticated app frame — sidebar + topbar + main content area.
 */
export function Shell({
  user,
  crumbs,
  topbarStatus,
  topbarActions,
  children,
}: {
  user: User;
  crumbs: string[];
  topbarStatus?: ReactNode;
  topbarActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar user={user} />
      <main className="main">
        <Topbar crumbs={crumbs} status={topbarStatus} actions={topbarActions} />
          <div className="content">{children}</div>
      </main>
    </div>
  );
}
