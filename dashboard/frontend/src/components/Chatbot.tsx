"use client";

import { useMemo, useState } from "react";
import styles from "./Chatbot.module.css";

type Author = "bot" | "user";
type Message = { author: Author; text: string };

const QUICK_QUESTIONS = [
  "C'est quoi Verado ?",
  "Comment se connecter ?",
  "Qui sont les partenaires ?",
  "Comment vous contacter ?",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      author: "bot",
      text: "Bonjour, je suis l'assistant Verado. Comment puis-je vous aider ?",
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  async function send(text: string) {
    const userText = text.trim();
    if (!userText || isLoading) return;

    setMessages((prev) => [...prev, { author: "user", text: userText }]);
    setInput("");

    setIsLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { author: "bot", text: "Le service chatbot est indisponible pour le moment." },
        ]);
        return;
      }

      const data = (await res.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        {
          author: "bot",
          text:
            data.reply ??
            "Je n'ai pas pu generer une reponse. Reessayez dans quelques secondes.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { author: "bot", text: "Erreur reseau. Verifiez la connexion puis reessayez." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {open && (
        <section className={styles.panel} aria-label="Chatbot Verado">
          <header className={styles.header}>
            <strong>Assistant Verado</strong>
            <button type="button" onClick={() => setOpen(false)} className={styles.iconBtn} aria-label="Fermer">
              x
            </button>
          </header>

          <div className={styles.messages}>
            {messages.map((m, idx) => (
              <div key={idx} className={m.author === "bot" ? styles.msgBot : styles.msgUser}>
                {m.text}
              </div>
            ))}
            {isLoading && <div className={styles.msgBot}>...</div>}
          </div>

          <div className={styles.quickRow}>
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} type="button" className={styles.quickBtn} onClick={() => send(q)} disabled={isLoading}>
                {q}
              </button>
            ))}
          </div>

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              className={styles.input}
              disabled={isLoading}
            />
            <button type="submit" className={styles.sendBtn} disabled={!canSend || isLoading}>
              {isLoading ? "..." : "Envoyer"}
            </button>
          </form>
        </section>
      )}

      <button type="button" className={styles.fab} onClick={() => setOpen((v) => !v)} aria-label="Ouvrir le chatbot">
        {open ? "Fermer" : "Chatbot"}
      </button>
    </div>
  );
}
