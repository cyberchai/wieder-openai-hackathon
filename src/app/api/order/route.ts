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
  needs_confirmation?: boolean;
  questions?: string[];
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

// Enhanced system prompt for intelligent order matching
const SYSTEM_PROMPT = `You are an intelligent order processing assistant. Convert user text into a JSON order with smart matching.

ALWAYS return valid JSON with these exact fields:
- items: array of items (can be empty)
- fulfillment: object with type ("pickup" or "delivery") 
- needs_confirmation: boolean
- questions: array of strings (if needs_confirmation is true)

SMART MATCHING RULES:
1. Use fuzzy matching - "chai tea" matches "chai tea latte", "coffee" matches "americano", etc.
2. Be generous with matches - if 80%+ of the words match, it's a good match
3. Only ask for confirmation if you're genuinely uncertain (less than 70% match)
4. For clear matches, set needs_confirmation: false and confidence: 0.9+
5. Always include fulfillment with type "pickup"

EXAMPLES:
- "chai tea" → "chai tea latte" (needs_confirmation: false)
- "matcha" → "matcha latte" (needs_confirmation: false) 
- "cold brew" → "cold brew coffee" (needs_confirmation: false)
- "something sweet" → needs_confirmation: true (too vague)

Output ONLY valid JSON, no other text.

Example output:
{"items":[{"menu_item":"Chai Tea Latte","qty":1,"size":"Medium","confidence":0.95}],"fulfillment":{"type":"pickup"},"needs_confirmation":false,"questions":[]}`;

// Simplified JSON Schema for order structure
const ORDER_SCHEMA = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "menu_item": { "type": "string" },
          "qty": { "type": "integer", "minimum": 1 },
          "size": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["menu_item","qty"]
      }
    },
    "fulfillment": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["pickup","delivery"] }
      },
      "required": ["type"]
    },
    "needs_confirmation": { "type": "boolean" },
    "questions": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["items","fulfillment","needs_confirmation"]
};

// Helper to call the model with the new Responses API
async function completeOrderJSON({
  menu,
  userText,
  customerName = "",
  customerPhone = "",
  fulfillmentDefault = "pickup",
  timeHint = "ASAP"
}: {
  menu: any;
  userText: string;
  customerName?: string;
  customerPhone?: string;
  fulfillmentDefault?: string;
  timeHint?: string;
}) {
  const userMsg = `Menu: ${JSON.stringify(menu)}

User order: ${userText}

Convert this to JSON order format.`;

  try {
    // Use the enhanced system with chat.completions API
    const res = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg }
      ],
      max_completion_tokens: 800,
      response_format: { type: "json_object" } as any
    });

    const content = res.choices?.[0]?.message?.content ?? "";
    console.log("OpenAI response content:", content);
    
    // Check if response is empty or too short
    if (!content || content.trim().length < 10) {
      console.error("Empty or very short response from OpenAI, using fallback");
      // Return a fallback response that asks for confirmation
      return JSON.stringify({
        items: [],
        fulfillment: { type: "pickup" },
        needs_confirmation: true,
        questions: ["I didn't understand your order. Could you please specify what you'd like?"]
      });
    }
    
    return content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // Return a fallback response instead of throwing
    console.log("Using fallback response due to API error");
    return JSON.stringify({
      items: [],
      fulfillment: { type: "pickup" },
      needs_confirmation: true,
      questions: ["I'm having trouble processing your order. Could you please try again?"]
    });
  }
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

    // 2) Build simplified menu structure
    const enhancedMenu = {
      venue: merchant.name,
      items: (merchant.menu?.items ?? []).map((item: any) => ({
        name: item.name,
        sizes: item.sizes || ["Medium"],
        modifiers: item.modifiers || []
      }))
    };

    // 3) Call model with enhanced system
    const jsonText = await completeOrderJSON({
      menu: enhancedMenu,
      userText: query,
      customerName: (decoded as any).email || "Guest",
      customerPhone: "",
      fulfillmentDefault: "pickup",
      timeHint: "ASAP"
    });

    let parsed: {
      items: Array<{
        menu_item: string;
        qty: number;
        size?: string;
        modifiers?: string[];
        notes?: string;
        price?: number;
        line_total?: number;
      }>;
      fulfillment: {
        type: "pickup" | "delivery";
        time?: string;
      };
      customer?: {
        name?: string;
        phone?: string;
      };
      order_total?: number;
      source?: {
        venue?: string;
        menu_version?: string;
      };
      needs_confirmation?: boolean;
      questions?: string[];
    };

    try {
      console.log("Attempting to parse JSON:", jsonText);
      parsed = JSON.parse(jsonText);
      
      // Validate required fields
      if (!parsed.items || !Array.isArray(parsed.items)) {
        console.error("Missing or invalid items array");
        return NextResponse.json({ error: "Invalid response: missing items" }, { status: 502 });
      }
      
      if (!parsed.fulfillment || !parsed.fulfillment.type) {
        console.error("Missing or invalid fulfillment object");
        return NextResponse.json({ error: "Invalid response: missing fulfillment" }, { status: 502 });
      }
      
      if (typeof parsed.needs_confirmation !== "boolean") {
        console.error("Missing or invalid needs_confirmation field");
        return NextResponse.json({ error: "Invalid response: missing needs_confirmation" }, { status: 502 });
      }
      
      // Validate items have required fields
      for (const item of parsed.items) {
        if (!item.menu_item || !item.qty) {
          console.error("Item missing required fields:", item);
          return NextResponse.json({ error: "Invalid response: item missing menu_item or qty" }, { status: 502 });
        }
      }
      
    } catch (error) {
      console.error("JSON parsing error:", error);
      console.error("Raw response that failed to parse:", jsonText);
      return NextResponse.json({ 
        error: "Invalid JSON from model", 
        debug: { 
          rawResponse: jsonText,
          responseLength: jsonText?.length || 0
        }
      }, { status: 502 });
    }

    // 4) Map new structure to OrderJSON shape
    const mappedOrder: OrderJSON = {
      items: parsed.items.map(item => ({
        name: item.menu_item,
        size: item.size || undefined,
        modifiers: [],
        qty: item.qty || 1,
      })),
      fulfillment: {
        type: parsed.fulfillment.type,
        time: "",
      },
      customer: {
        name: "Guest",
        phone: "",
      },
      payment: {
        type: "card_test",
      },
    };

    // 6) Attach metadata and backstop defaults
    mappedOrder._requestedBy = (decoded as any).email || (decoded as any).uid || "unknown";

    const result: OrderProcessingResponse = {
      order: mappedOrder,
      suggestions: [], // New system doesn't provide suggestions in the same format
      clarifications: [], // New system doesn't provide clarifications in the same format
      merchant: { id: merchantIdentifier, name: merchant.name, menu: merchant.menu },
      needs_confirmation: parsed.needs_confirmation || false,
      questions: parsed.questions || [],
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Order processing error (responses api):", err);
    return NextResponse.json({ error: "Failed to process order" }, { status: 500 });
  }
}
