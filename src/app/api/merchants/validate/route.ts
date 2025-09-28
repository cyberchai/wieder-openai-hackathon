import { NextResponse } from "next/server";
import type { MerchantConfig } from "@/src/types/merchant";

export async function POST(req: Request) {
  const cfg = (await req.json()) as MerchantConfig;
  const missing: string[] = [];

  if (!cfg?.name) missing.push("name");
  if (!cfg?.baseUrl) missing.push("baseUrl");
  if (!cfg?.selectors) missing.push("selectors");

  const must = ["button.add", "button.checkout", "field.name", "field.phone", "field.time"];
  for (const key of must) {
    if (!cfg?.selectors?.[key]) missing.push(`selectors.${key}`);
  }

  const hasItem = Object.keys(cfg?.selectors || {}).some((k) => k.startsWith("item."));
  if (!hasItem) missing.push("selectors.item.<your-item>");

  return NextResponse.json({ ok: missing.length === 0, missing });
}
