import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/authGuard";
import { listMerchants, createMerchant, ensureUniqueId } from "@/src/lib/merchantsStore";
import type { MerchantConfig } from "@/src/types/merchant";
import { slugify } from "@/src/lib/slug";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ownerEmail = url.searchParams.get('ownerEmail');
  
  console.log("API: Fetching merchants, ownerEmail:", ownerEmail);
  
  const merchants = await listMerchants();
  console.log("API: Total merchants found:", merchants.length);
  console.log("API: Merchant ownerEmails:", merchants.map(m => ({ id: m.id, ownerEmail: m.ownerEmail })));
  
  if (ownerEmail) {
    const filteredMerchants = merchants.filter(
      merchant => merchant.ownerEmail === ownerEmail
    );
    console.log("API: Filtered merchants for", ownerEmail, ":", filteredMerchants.length);
    return NextResponse.json({ merchants: filteredMerchants });
  }
  
  return NextResponse.json({ merchants });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json()) as Partial<MerchantConfig>;
  if (!body?.name || !body?.baseUrl) {
    return NextResponse.json({ error: "name and baseUrl required" }, { status: 400 });
  }

  const baseId = slugify(body.name);
  const id = await ensureUniqueId(baseId);

  const cfg: MerchantConfig = {
    id,
    name: body.name,
    baseUrl: body.baseUrl,
    selectors: body.selectors || {},
    menu: body.menu || { items: [] },
    normalize: body.normalize || {},
    availability: body.availability || {},
    verification: body.verification || { summarySelector: "[data-testid='order-summary']" },
    checkout:
      body.checkout || {
        defaults: { name: "Guest", phone: "555-0101", time: "12:30" },
        fields: { name: "field.name", phone: "field.phone", time: "field.time" },
      },
    ownerUid: user.uid,
    ownerEmail: user.email || undefined,
  };

  const saved = await createMerchant(id, cfg);
  return NextResponse.json(saved, { status: 201 });
}