import { NextResponse } from "next/server";
import { getMerchant, updateMerchant, deleteMerchant } from "@/src/lib/merchantsStore";
import { requireUser } from "@/src/lib/authGuard";
import type { MerchantConfig } from "@/src/types/merchant";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const cfg = await getMerchant(params.id);
  if (!cfg) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(cfg);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const existing = await getMerchant(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.ownerUid && existing.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<MerchantConfig>;
  const merged: Partial<MerchantConfig> = {
    ...body,
    id: params.id,
    ownerUid: existing.ownerUid,
    ownerEmail: existing.ownerEmail,
  };
  const saved = await updateMerchant(params.id, merged);
  return NextResponse.json(saved);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const existing = await getMerchant(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.ownerUid && existing.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await deleteMerchant(params.id);
  return NextResponse.json({ ok: true });
}
