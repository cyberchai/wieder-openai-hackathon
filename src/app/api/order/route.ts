import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/authGuard";
import { openai } from "@/src/lib/openai";
import { getMerchant } from "@/src/lib/merchantsStore";
import type { OrderJSON } from "@/src/types/order";
import type { MerchantConfig } from "@/src/types/merchant";

interface OrderProcessingRequest {
  query: string;
  merchantId?: string;
  // Optional: pass a CSV to demo without a stored merchant
  // CSV columns (flexible): name,sizes,modifiers
  // sizes/modifiers can be pipe- or slash-separated (e.g., "Small|Medium|Large")
  menuCSV?: string;
}

interface OrderProcessingResponse {
  order: OrderJSON;
  suggestions?: string[];
  clarifications?: string[];
  merchant: {
    id: string;
    name: string;
    menu: any;
  };
}

// Tiny CSV parser for demo (no quotes/escapes). Good enough for short menus.
function parseMenuCSV(csv: string) {
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map(h => h.trim().toLowerCase());
  const idx = {
    name: headers.indexOf("name"),
    sizes: headers.indexOf("sizes"),
    modifiers: headers.indexOf("modifiers"),
  };
  const splitList = (s: string | undefined) =>
    (s || "")
      .split(/[|/;,]/) // allow multiple separators
      .map(x => x.trim())
      .filter(Boolean);

  return rows.map(r => {
    const cols = r.split(",").map(c => c.trim());
    return {
      name: idx.name >= 0 ? cols[idx.name] : cols[0],
      sizes: idx.sizes >= 0 ? splitList(cols[idx.sizes]) : [],
      modifiers: idx.modifiers >= 0 ? splitList(cols[idx.modifiers]) : [],
    };
  }).filter(x => !!x.name);
}

// Helper to call the model with compact prompt & retry on length
async function completeOrderJSON({
  systemPrompt,
  userQuery,
  maxTokens = 1200,
}: {
  systemPrompt: string;
  userQuery: string;
  maxTokens?: number;
}) {
  const call = async (cap: number) => {
    const res = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
      max_completion_tokens: cap,
      response_format: { type: "json_object" } as any,
    });

    const choice = res.choices?.[0];
    const content = choice?.message?.content ?? "";
    const lengthCapped = choice?.finish_reason === "length";
    return { content, lengthCapped };
  };

  let { content, lengthCapped } = await call(maxTokens);

  // Retry once with a bigger cap and a compacting nudge
  if ((!content || content.trim() === "") || lengthCapped) {
    const compactUserQuery =
      userQuery +
      "\n\nReturn the JSON in one line with no spaces and the shortest possible strings.";
    ({ content } = await call(Math.min(maxTokens * 2, 2400)));
    if (!content || content.trim() === "") {
      throw new Error("Model returned empty content after retry");
    }
  }
  return content;
}

export async function POST(req: Request) {
  try {
    const decoded = await requireUser(req);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = (await req.json()) as OrderProcessingRequest | null;
    if (!body || typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const { query, merchantId, menuCSV } = body;

    // 1) Resolve merchant or build a transient one from CSV
    let merchant: MerchantConfig | null = null;
    let merchantIdentifier = "";
    if (merchantId) {
      merchant = await getMerchant(merchantId);
      if (!merchant) {
        return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
      }
      merchantIdentifier = merchantId;
    } else {
      // Transient merchant built from CSV (no domain assumptions)
      const itemsFromCSV = menuCSV ? parseMenuCSV(menuCSV) : [];
      merchant = {
        id: "transient:csv",
        name: "Transient Merchant",
        baseUrl: "",
        selectors: {},
        menu: { items: itemsFromCSV },
      } as unknown as MerchantConfig;
      merchantIdentifier = merchant.id || "transient:csv";
    }

    // 2) Build compact menu payload (names + sizes + modifiers only)
    const compactMenuItems = (merchant.menu?.items ?? []).map((i: any) => ({
      n: i.name, s: i.sizes ?? [], m: i.modifiers ?? [],
    }));

    // 3) Compact system prompt
    const systemPrompt = `You are an ASAPly order parser. Output STRICT JSON only.

Schema:
{"order":{"items":[{"n":"name","sz":"size|null","mods":["string"],"q":1}],
"fulfillment":{"t":"pickup|delivery","time":"string|null"},
"customer":{"n":"string","ph":"string|null"},
"payment":{"t":"card_test|apple_pay_test|stripe_test"}},
"suggestions":["string"],"clarifications":["string"]}

Rules: match menu names; default sz to middle; replace/omit unknown modifiers and add clarification; defaults: pickup, Guest, card_test. No extra text.

Merchant:${merchant.name}
Menu:${JSON.stringify(compactMenuItems)}`;

    // 4) Call model with retry logic
    const userQuery = `User request: ${query}`;
    const jsonText = await completeOrderJSON({ systemPrompt, userQuery });

    let parsed: {
      order: {
        items: Array<{ n: string; sz?: string | null; mods?: string[]; q?: number }>;
        fulfillment: { t: string; time?: string | null };
        customer: { n: string; ph?: string | null };
        payment: { t: string };
      };
      suggestions?: string[];
      clarifications?: string[];
    };

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 502 });
    }

    // 5) Map compact keys back to OrderJSON shape
    const mappedOrder: OrderJSON = {
      items: parsed.order.items.map(item => ({
        name: item.n,
        size: item.sz || undefined,
        modifiers: item.mods || [],
        qty: item.q || 1,
      })),
      fulfillment: {
        type: parsed.order.fulfillment.t as "pickup" | "delivery",
        time: parsed.order.fulfillment.time || "",
      },
      customer: {
        name: parsed.order.customer.n,
        phone: parsed.order.customer.ph || "",
      },
      payment: {
        type: "card_test",
      },
    };

    // 6) Attach metadata and backstop defaults
    mappedOrder._requestedBy = (decoded as any).email || (decoded as any).uid || "unknown";

    const result: OrderProcessingResponse = {
      order: mappedOrder,
      suggestions: parsed.suggestions ?? [],
      clarifications: parsed.clarifications ?? [],
      merchant: { id: merchantIdentifier, name: merchant.name, menu: merchant.menu },
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Order processing error (responses api):", err);
    return NextResponse.json({ error: "Failed to process order" }, { status: 500 });
  }
}
