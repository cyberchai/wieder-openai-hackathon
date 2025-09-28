import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/authGuard";
import { openai } from "@/src/lib/openai";

interface FollowupRequest {
  previousOrder: any;
  userResponse: string;
}

// Enhanced system prompt for follow-up processing
const FOLLOWUP_SYSTEM_PROMPT = `You are processing a follow-up response to refine an order with intelligent matching.

ALWAYS return valid JSON with these exact fields:
- items: array of items (can be empty)
- fulfillment: object with type ("pickup" or "delivery") 
- needs_confirmation: boolean
- questions: array of strings (if needs_confirmation is true)

INTELLIGENT RESPONSE PROCESSING:
1. Use fuzzy matching - "chai tea" matches "chai tea latte", "coffee" matches "americano", etc.
2. Be generous with matches - if 80%+ of the words match, it's a good match
3. If user confirms (yes/yeah/sure/okay), proceed with the suggested item
4. If user declines (no/nope), return empty items with needs_confirmation: true
5. If user specifies a different item, match it intelligently to the menu
6. Only ask for confirmation if genuinely uncertain (less than 70% match)
7. For clear matches, set needs_confirmation: false and confidence: 0.9+

EXAMPLES:
- User says "yes" to "chai tea latte" → proceed with chai tea latte
- User says "chai tea" → match to "chai tea latte" (needs_confirmation: false)
- User says "no" → return empty items with needs_confirmation: true
- User says "something else" → needs_confirmation: true (too vague)

Output ONLY valid JSON, no other text.

Example output:
{"items":[{"menu_item":"Chai Tea Latte","qty":1,"size":"Medium","confidence":0.95}],"fulfillment":{"type":"pickup"},"needs_confirmation":false,"questions":[]}`;

export async function POST(req: Request) {
  try {
    const decoded = await requireUser(req);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = (await req.json()) as FollowupRequest | null;
    if (!body || !body.previousOrder || !body.userResponse) {
      return NextResponse.json({ error: "Previous order and user response are required" }, { status: 400 });
    }

    const { previousOrder, userResponse } = body;

    const userMsg = `Previous order: ${JSON.stringify(previousOrder)}

User response: ${userResponse}

Refine the order based on this response.`;

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: FOLLOWUP_SYSTEM_PROMPT },
          { role: "user", content: userMsg }
        ],
        max_completion_tokens: 600,
        response_format: { type: "json_object" } as any
      });

      const content = res.choices?.[0]?.message?.content ?? "";
      console.log("Followup OpenAI response:", content);
      
      if (!content || content.trim().length < 10) {
        console.error("Empty followup response, using fallback");
        return NextResponse.json({
          items: [],
          fulfillment: { type: "pickup" },
          needs_confirmation: true,
          questions: ["I didn't understand your response. Could you please try again?"]
        });
      }

      const parsed = JSON.parse(content);
      
      // Validate required fields
      if (!parsed.items || !Array.isArray(parsed.items)) {
        return NextResponse.json({ error: "Invalid response: missing items" }, { status: 502 });
      }
      
      if (!parsed.fulfillment || !parsed.fulfillment.type) {
        return NextResponse.json({ error: "Invalid response: missing fulfillment" }, { status: 502 });
      }
      
      if (typeof parsed.needs_confirmation !== "boolean") {
        return NextResponse.json({ error: "Invalid response: missing needs_confirmation" }, { status: 502 });
      }

      return NextResponse.json(parsed, { status: 200 });
      
    } catch (error) {
      console.error("Error calling OpenAI API for followup:", error);
      return NextResponse.json({
        items: [],
        fulfillment: { type: "pickup" },
        needs_confirmation: true,
        questions: ["I'm having trouble processing your response. Could you please try again?"]
      });
    }

  } catch (err) {
    console.error("Followup processing error:", err);
    return NextResponse.json({ error: "Failed to process followup" }, { status: 500 });
  }
}
