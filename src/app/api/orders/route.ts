import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/authGuard";
import { appendOrder, listRecentOrders } from "@/src/lib/merchantsStore";

export async function GET() {
  const items = await listRecentOrders(10);
  return NextResponse.json({ orders: items });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { plan, merchant, status } = await req.json().catch(() => ({}));
  if (!plan || !merchant) {
    return NextResponse.json({ error: "plan and merchant required" }, { status: 400 });
  }

  const id = await appendOrder({
    plan,
    merchant,
    requestedBy: user.email || user.uid,
    status: status === "PASS" || status === "FAIL" ? status : "UNKNOWN",
  });
  return NextResponse.json({ ok: true, id });
}
