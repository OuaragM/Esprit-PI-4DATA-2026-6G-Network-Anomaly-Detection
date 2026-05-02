"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "sentra_theme";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    if (typeof window !== "undefined") localStorage.setItem(KEY, next);
  }

  // Avoid SSR/CSR mismatch on first paint
  if (!mounted) return <button className="icon-btn" aria-label="Toggle theme" />;

  const isDark = theme === "dark";
  return (
    <button
      className="icon-btn"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
    >
      <svg width={15} height={15} viewBox="0 0 20 20">
        {isDark ? (
          // moon
          <path
            d="M16 11A6 6 0 1 1 9 4a5 5 0 0 0 7 7z"
            fill="none" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"
          />
        ) : (
          // sun
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
          </g>
        )}
      </svg>
    </button>
  );
}
