import { NextResponse } from "next/server";

type NewsletterRequest = {
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NewsletterRequest;
    const email = body.email?.trim().toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "valid email is required" }, { status: 400 });
    }

    // Placeholder persistence point. Replace with DB insert or email provider API.
    return NextResponse.json({ ok: true, email, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "invalid json payload" }, { status: 400 });
  }
}
