import { NextResponse } from "next/server";

type ChatRequest = {
  message?: string;
};

function answerFor(input: string): string {
  const q = input.toLowerCase();

  if (q.includes("verado") || q.includes("projet") || q.includes("project")) {
    return "Verado est une plateforme IDS intelligente pour detecter les anomalies et cyberattaques dans les reseaux 5G/6G.";
  }
  if (q.includes("connect") || q.includes("login") || q.includes("compte")) {
    return "Vous pouvez vous connecter via la page login. En demo, utilisez admin@esprit.tn / Admin123! (si ce compte est actif sur votre instance).";
  }
  if (q.includes("partenaire") || q.includes("partner") || q.includes("technologie")) {
    return "Le projet s'appuie sur ESPRIT et des outils comme MLflow, Prometheus, Grafana, Docker et GitHub Actions.";
  }
  if (q.includes("contact") || q.includes("email") || q.includes("joindre")) {
    return "Vous pouvez nous ecrire via la section Contact de la page accueil.";
  }
  if (q.includes("avantage") || q.includes("why") || q.includes("pourquoi")) {
    return "Verado combine detection zero-day, monitoring temps reel, pipeline MLOps et architecture microservices pour une meilleure fiabilite.";
  }

  return "Je peux vous aider sur le projet, la connexion, les partenaires, les avantages et le contact. Posez-moi une question plus precise.";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    return NextResponse.json({
      reply: answerFor(message),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "invalid json payload" }, { status: 400 });
  }
}
