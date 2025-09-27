import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebaseAdmin";
import { openai } from "@/src/lib/openai";
import type { OrderJSON } from "@/src/types/order";

const systemPrompt = `Convert café orders into strict JSON with this schema:
{
  "items":[{"name":"","size":"","modifiers":[]}],
  "fulfillment":{"type":"pickup","time":""},
  "customer":{"name":"","phone":""},
  "payment":{"type":"card_test"}
}
Respond ONLY with valid JSON.`;

export async function POST(req: Request) {
  try {
    const authz = req.headers.get("authorization") || "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const resp = await openai.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    });

    const json = JSON.parse((resp as any).output_text) as OrderJSON;
    json._requestedBy = decoded.email || decoded.uid;
    return NextResponse.json(json);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
