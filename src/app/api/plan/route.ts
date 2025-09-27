import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/authGuard";
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

type ResponsesOutput = { output_text?: string };

export async function POST(req: Request) {
  try {
    const decoded = await requireUser(req);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

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
      // response_format: { type: "json_object" },
    });

    const text = (resp as ResponsesOutput).output_text;
    if (!text) {
      return NextResponse.json({ error: "Malformed OpenAI response" }, { status: 500 });
    }

    const json = JSON.parse(text) as OrderJSON;
    json._requestedBy = decoded.email || decoded.uid;
    return NextResponse.json(json);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
