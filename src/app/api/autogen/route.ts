import { NextResponse } from "next/server";
import { buildDraftConfig } from "@/src/lib/autogen";

export async function POST(req: Request) {
  try {
    const { baseUrl, headers, maxUrls } = (await req.json()) as {
      baseUrl?: string;
      headers?: Record<string, string>;
      maxUrls?: number;
    };
    if (!baseUrl) {
      return NextResponse.json({ ok: false, reason: "missing-baseUrl" }, { status: 400 });
    }

    const result = await buildDraftConfig(baseUrl, { headers, maxUrls });
    return NextResponse.json(result);
  } catch (error) {
    console.error("autogen", error);
    return NextResponse.json({ ok: false, reason: "unexpected" }, { status: 500 });
  }
}
