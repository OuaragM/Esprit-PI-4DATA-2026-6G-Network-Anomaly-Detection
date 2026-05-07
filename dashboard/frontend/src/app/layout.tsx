import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata = {
  title: "Verado — 6G Anomaly Detection",
  description: "AI-driven attack detection for sliced 6G networks",
};

// Inline pre-paint scripts: read persisted theme + locale from localStorage
// and apply both BEFORE React hydrates, so users don't see a flash on load.
const bootScript = `(function(){
  try {
    var t = localStorage.getItem("sentra_theme");
    if (t !== "light" && t !== "dark") t = "dark";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  try {
    var l = localStorage.getItem("sentra_lang");
    if (l !== "en" && l !== "fr") {
      l = (navigator.language || "").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
    }
    document.documentElement.setAttribute("lang", l);
  } catch (e) {
    document.documentElement.setAttribute("lang", "en");
  }
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}